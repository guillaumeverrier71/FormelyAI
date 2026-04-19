import io
import csv
import json
import os
import random
import secrets
import tempfile
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()
from typing import Optional

import pdfplumber
import stripe
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import or_, func
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel

from database import get_db, init_db, Session, QA, Summary, User, Subscription, ReviewLog, PasswordResetToken
from ai_service import generate_qa_and_summaries
from auth import hash_password, verify_password, create_access_token, get_current_user, get_optional_user

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(title="FormelyAI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Stripe config
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_PRICE_MONTHLY = os.environ.get("STRIPE_PRICE_MONTHLY", "")
STRIPE_PRICE_CREDITS = os.environ.get("STRIPE_PRICE_CREDITS", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
APP_URL = os.environ.get("APP_URL", "http://localhost:5173")
IS_PRODUCTION = os.environ.get("VERCEL", "") != ""

# Serve built frontend static files
if os.path.isdir("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
    if os.path.isdir("frontend/dist/icons"):
        app.mount("/icons", StaticFiles(directory="frontend/dist/icons"), name="icons")

@app.get("/favicon.ico")
async def favicon():
    return FileResponse("frontend/dist/icons/favicon.ico", media_type="image/x-icon")

@app.get("/manifest.webmanifest")
async def manifest():
    return FileResponse("frontend/dist/manifest.webmanifest", media_type="application/manifest+json")

@app.get("/sw.js")
async def sw():
    return FileResponse("frontend/dist/sw.js", media_type="application/javascript")

@app.get("/registerSW.js")
async def register_sw():
    return FileResponse("frontend/dist/registerSW.js", media_type="application/javascript")

@app.get("/workbox-{hash}.js")
async def workbox(hash: str):
    return FileResponse(f"frontend/dist/workbox-{hash}.js", media_type="application/javascript")

# Admin emails — unlimited uploads + all Premium features, no Stripe needed
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
RESEND_FROM = os.environ.get("RESEND_FROM", "FormelyAI <onboarding@resend.dev>")
PDF_MAX_MB = 20
PDF_MAX_BYTES = PDF_MAX_MB * 1024 * 1024

ADMIN_EMAILS = {
    e.strip().lower()
    for e in os.environ.get("ADMIN_EMAILS", "").split(",")
    if e.strip()
}

def is_admin(user: User) -> bool:
    return user.email.lower() in ADMIN_EMAILS

def _get_admin_user_ids(db: DBSession) -> set:
    if not ADMIN_EMAILS:
        return set()
    return {u.id for u in db.query(User).filter(func.lower(User.email).in_(ADMIN_EMAILS)).all()}

# Spaced repetition — algorithme SM-2
# quality: 1=Again, 2=Hard, 4=Good, 5=Easy
FREE_UPLOAD_LIMIT = 1
PREMIUM_MONTHLY_LIMIT = 20

# ── Gamification ──────────────────────────────────────────────────────────────
# XP thresholds per level (index = level-1)
XP_LEVELS = [0, 100, 300, 600, 1000, 1500, 2500, 4000, 6000, 10000]

XP_SESSION_AI     = 25   # générer un deck avec l'IA
XP_SESSION_MANUAL = 10   # créer un deck manuellement
XP_REVIEW         = 10   # marquer une carte révisée (hors practice)
XP_PRACTICE_CARD  = 5    # bonne réponse en practice
XP_PRACTICE_DONE  = 20   # bonus fin de session practice

BADGES_DEF = {
    # Révisions
    "first_review":  {"icon": "🎯", "name": "Premier pas",      "desc": "Première carte révisée"},
    "reviewed_10":   {"icon": "📚", "name": "Studieux",          "desc": "10 cartes révisées"},
    "reviewed_50":   {"icon": "🔥", "name": "En feu",            "desc": "50 cartes révisées"},
    "reviewed_100":  {"icon": "🏆", "name": "Expert",            "desc": "100 cartes révisées"},
    "reviewed_200":  {"icon": "🌟", "name": "Assidu",            "desc": "200 cartes révisées"},
    "reviewed_500":  {"icon": "🚀", "name": "Inarrêtable",       "desc": "500 cartes révisées"},
    "reviewed_1000": {"icon": "👑", "name": "Légende",           "desc": "1 000 cartes révisées"},
    # Decks
    "creator":       {"icon": "🎓", "name": "Créateur",          "desc": "Premier deck créé"},
    "librarian":     {"icon": "📖", "name": "Bibliothécaire",    "desc": "5 decks créés"},
    "librarian_10":  {"icon": "🗂️",  "name": "Archiviste",        "desc": "10 decks créés"},
    "librarian_20":  {"icon": "🏛️",  "name": "Encyclopédiste",    "desc": "20 decks créés"},
    "shared":        {"icon": "🌍", "name": "Généreux",          "desc": "Premier deck partagé"},
    # Practice
    "perfect":       {"icon": "💯", "name": "Perfectionniste",   "desc": "100 % à une session Practice"},
    "perfect_3":     {"icon": "🥇", "name": "Champion",          "desc": "3 sessions Practice parfaites"},
    "streak_10":     {"icon": "⚡", "name": "Fulgurant",         "desc": "10 bonnes réponses d'affilée"},
    "streak_25":     {"icon": "🌪️", "name": "Tornade",           "desc": "25 bonnes réponses d'affilée"},
    # Niveaux
    "level_3":       {"icon": "🥉", "name": "Lancé",             "desc": "Niveau 3 atteint"},
    "level_5":       {"icon": "⭐", "name": "Étoile montante",   "desc": "Niveau 5 atteint"},
    "level_7":       {"icon": "💫", "name": "Brillant",          "desc": "Niveau 7 atteint"},
    "level_10":      {"icon": "💎", "name": "Maître",            "desc": "Niveau 10 atteint"},
}

def xp_to_level(xp: int) -> int:
    for i in range(len(XP_LEVELS) - 1, -1, -1):
        if xp >= XP_LEVELS[i]:
            return i + 1
    return 1

def _get_or_create_sub(user: User, db: DBSession) -> "Subscription":
    sub = user.subscription
    if not sub:
        sub = Subscription(user_id=user.id)
        db.add(sub)
        db.commit()
        db.refresh(sub)
    return sub

def _add_xp(user: User, amount: int, db: DBSession, extra: dict = None) -> dict:
    """Add XP, check level-up and badges. Returns events dict for the frontend."""
    sub = _get_or_create_sub(user, db)
    sub.xp               = (sub.xp or 0)
    sub.cards_reviewed   = (sub.cards_reviewed or 0)
    sub.sessions_created = (sub.sessions_created or 0)
    sub.badges           = sub.badges or "[]"

    old_level = xp_to_level(sub.xp)
    sub.xp += amount
    new_level = xp_to_level(sub.xp)
    xp_next = XP_LEVELS[min(new_level, len(XP_LEVELS) - 1)]

    if extra:
        sub.cards_reviewed   += extra.get("cards_reviewed", 0)
        sub.sessions_created += extra.get("sessions_created", 0)

    if extra and extra.get("perfect"):
        sub.perfect_count = (sub.perfect_count or 0) + 1

    earned = set(json.loads(sub.badges))
    new_badges = []
    cr = sub.cards_reviewed
    sc = sub.sessions_created
    pc = sub.perfect_count or 0
    checks = [
        # Révisions
        ("first_review",  cr >= 1),
        ("reviewed_10",   cr >= 10),
        ("reviewed_50",   cr >= 50),
        ("reviewed_100",  cr >= 100),
        ("reviewed_200",  cr >= 200),
        ("reviewed_500",  cr >= 500),
        ("reviewed_1000", cr >= 1000),
        # Decks
        ("creator",       sc >= 1),
        ("librarian",     sc >= 5),
        ("librarian_10",  sc >= 10),
        ("librarian_20",  sc >= 20),
        ("shared",        bool(extra and extra.get("shared"))),
        # Practice
        ("perfect",       bool(extra and extra.get("perfect"))),
        ("perfect_3",     pc >= 3),
        ("streak_10",     bool(extra and extra.get("streak_10"))),
        ("streak_25",     bool(extra and extra.get("streak_25"))),
        # Niveaux
        ("level_3",       new_level >= 3),
        ("level_5",       new_level >= 5),
        ("level_7",       new_level >= 7),
        ("level_10",      new_level >= 10),
    ]
    for badge_id, condition in checks:
        if condition and badge_id not in earned:
            earned.add(badge_id)
            new_badges.append({"id": badge_id, **BADGES_DEF[badge_id]})

    sub.badges = json.dumps(list(earned))
    db.commit()

    return {
        "xp_gained":  amount,
        "xp_total":   sub.xp,
        "level":      new_level,
        "xp_next":    xp_next,
        "level_up":   new_level > old_level,
        "new_badges": new_badges,
    }


def _send_email(to: str, subject: str, html: str):
    """Send an email via Resend. Silently skips if RESEND_API_KEY is not set."""
    if not RESEND_API_KEY:
        return
    try:
        import requests as req
        req.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={"from": RESEND_FROM, "to": [to], "subject": subject, "html": html},
            timeout=8,
        )
    except Exception:
        pass  # Never let email errors break the main flow


def _welcome_email_html(email: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px 24px;background:#f8fafc;border-radius:16px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:#7c3aed;border-radius:12px;padding:12px 20px">
          <span style="color:white;font-size:20px;font-weight:bold">Formerly<span style="color:#c4b5fd">AI</span></span>
        </div>
      </div>
      <h2 style="color:#1e293b;margin-bottom:8px">Bienvenue sur FormelyAI ! 🎉</h2>
      <p style="color:#475569;line-height:1.6">Ton compte a bien été créé avec l'adresse <strong>{email}</strong>.</p>
      <p style="color:#475569;line-height:1.6">Tu peux dès maintenant déposer tes cours en PDF ou coller ton texte pour générer des fiches intelligentes en quelques secondes.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="{APP_URL}" style="background:#7c3aed;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">
          Commencer à réviser →
        </a>
      </div>
      <p style="color:#94a3b8;font-size:13px;text-align:center">Des questions ? Réponds à cet email.</p>
    </div>"""


def _reset_email_html(reset_url: str) -> str:
    return f"""
    <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:32px 24px;background:#f8fafc;border-radius:16px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:#7c3aed;border-radius:12px;padding:12px 20px">
          <span style="color:white;font-size:20px;font-weight:bold">Formerly<span style="color:#c4b5fd">AI</span></span>
        </div>
      </div>
      <h2 style="color:#1e293b;margin-bottom:8px">Réinitialisation de ton mot de passe</h2>
      <p style="color:#475569;line-height:1.6">Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous — ce lien est valable <strong>1 heure</strong>.</p>
      <div style="text-align:center;margin:32px 0">
        <a href="{reset_url}" style="background:#7c3aed;color:white;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px">
          Réinitialiser mon mot de passe →
        </a>
      </div>
      <p style="color:#475569;line-height:1.6">Si tu n'as pas fait cette demande, ignore cet email — ton mot de passe reste inchangé.</p>
      <p style="color:#94a3b8;font-size:13px;text-align:center">Lien valable jusqu'à : {(datetime.utcnow() + timedelta(hours=1)).strftime("%d/%m/%Y à %H:%M")} UTC</p>
    </div>"""


@app.on_event("startup")
def startup():
    init_db()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FREE_MAX_PAGES = 10
FREE_MAX_QA    = 10

def extract_text_from_pdf(file_bytes: bytes, max_pages: int = None) -> tuple[str, int, int]:
    """Retourne (texte, pages_extraites, pages_totales)."""
    parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        total = len(pdf.pages)
        pages = pdf.pages[:max_pages] if max_pages else pdf.pages
        extracted = len(pages)
        for page in pages:
            t = page.extract_text()
            if t:
                parts.append(t)
    return "\n\n".join(parts), extracted, total


def sm2_schedule(qa, quality: int) -> None:
    """Algorithme SM-2 avec 4 niveaux de qualité.
    quality: 1=À revoir, 2=Difficile, 4=Bien, 5=Facile
    """
    ef = float(qa.ease_factor) if qa.ease_factor else 2.5
    iv = int(qa.interval) if qa.interval else 0
    reps = int(qa.review_count) if qa.review_count else 0

    if quality == 1:          # À revoir — lapse, remet à zéro
        reps = 0
        iv = 1
        ef = max(1.3, ef - 0.20)
    elif quality == 2:        # Difficile — progression lente
        if reps == 0:   iv = 1
        elif reps == 1: iv = 3
        else:           iv = max(iv + 1, round(iv * 1.2))
        ef = max(1.3, ef - 0.15)
        reps += 1
    elif quality == 4:        # Bien — progression standard SM-2
        if reps == 0:   iv = 1
        elif reps == 1: iv = 6
        else:           iv = round(iv * ef)
        reps += 1
    elif quality == 5:        # Facile — progression accélérée
        if reps == 0:   iv = 4
        elif reps == 1: iv = 9
        else:           iv = round(iv * ef * 1.3)
        ef = min(ef + 0.15, 4.0)
        reps += 1

    qa.ease_factor = max(1.3, ef)
    qa.interval = max(1, iv)
    qa.review_count = reps
    qa.last_reviewed = datetime.utcnow()
    qa.next_review = datetime.utcnow() + timedelta(days=qa.interval)


def _set_auth_cookie(response: JSONResponse, token: str):
    response.set_cookie(
        "access_token",
        token,
        httponly=True,
        samesite="lax",
        max_age=30 * 24 * 3600,
        secure=IS_PRODUCTION,
    )


def _user_info(user: User) -> dict:
    sub = user.subscription
    xp      = (sub.xp or 0) if sub else 0
    level   = xp_to_level(xp)
    xp_next = XP_LEVELS[min(level, len(XP_LEVELS) - 1)]
    badges  = json.loads(sub.badges or "[]") if sub else []

    if is_admin(user):
        return {
            "id": user.id,
            "email": user.email,
            "plan": "premium",
            "pdfs_used": 0,
            "monthly_limit": 9999,
            "pdf_credits": 0,
            "is_admin": True,
            "xp": xp, "level": level, "xp_next": xp_next, "badges": badges,
        }
    plan          = sub.plan if sub else "free"
    pdfs_used     = sub.pdfs_used_this_month if sub else 0
    pdf_credits   = sub.pdf_credits if sub else 0
    if plan == "premium":
        monthly_limit = PREMIUM_MONTHLY_LIMIT + pdf_credits
    else:
        monthly_limit = FREE_UPLOAD_LIMIT + pdf_credits
    return {
        "id": user.id,
        "email": user.email,
        "plan": plan,
        "pdfs_used": pdfs_used,
        "monthly_limit": monthly_limit,
        "pdf_credits": pdf_credits,
        "is_admin": False,
        "xp": xp, "level": level, "xp_next": xp_next, "badges": badges,
    }


def _check_and_increment_quota(user: User, db: DBSession):
    if is_admin(user):
        return  # no quota for admins

    sub = user.subscription
    if not sub:
        sub = Subscription(user_id=user.id)
        db.add(sub)
        db.commit()
        db.refresh(sub)

    if sub.plan == "premium":
        # Reset counter if new billing period
        if (datetime.utcnow() - sub.period_start).days >= 30:
            sub.pdfs_used_this_month = 0
            sub.period_start = datetime.utcnow()
            db.commit()
        allowed = PREMIUM_MONTHLY_LIMIT + sub.pdf_credits
        if sub.pdfs_used_this_month >= allowed:
            raise HTTPException(status_code=403, detail="quota_exceeded")
    else:
        allowed = FREE_UPLOAD_LIMIT + sub.pdf_credits
        if sub.pdfs_used_this_month >= allowed:
            raise HTTPException(status_code=403, detail="upgrade_required")

    sub.pdfs_used_this_month += 1
    db.commit()


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class QAOut(BaseModel):
    id: int
    question: str
    answer: str
    review_count: int
    next_review: datetime
    last_reviewed: Optional[datetime]

    class Config:
        from_attributes = True


class QACreate(BaseModel):
    question: str
    answer: str


class QAUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None


class SummaryOut(BaseModel):
    id: int
    chapter_title: str
    content: str

    class Config:
        from_attributes = True


class SessionOut(BaseModel):
    id: int
    title: str
    subject: Optional[str]
    created_at: datetime
    qa_count: int
    summary_count: int
    is_public: bool = False
    due_count: int = 0
    owner_email: Optional[str] = None

    class Config:
        from_attributes = True


class SessionDetail(SessionOut):
    qa_items: list[QAOut]
    summaries: list[SummaryOut]


class PublicSessionOut(BaseModel):
    id: int
    title: str
    subject: Optional[str]
    created_at: datetime
    qa_count: int
    summary_count: int
    author_email: str
    is_admin_deck: bool = False

    class Config:
        from_attributes = True


class RegisterBody(BaseModel):
    email: str
    password: str


class LoginBody(BaseModel):
    email: str
    password: str


# ---------------------------------------------------------------------------
# Routes – Frontend
# ---------------------------------------------------------------------------

@app.get("/")
@app.get("/index.html")
async def index():
    return FileResponse("frontend/dist/index.html")


@app.get("/auth/google-client-id")
def google_client_id_endpoint():
    return {"client_id": GOOGLE_CLIENT_ID}


# ---------------------------------------------------------------------------
# Routes – Auth
# ---------------------------------------------------------------------------

@app.post("/auth/register")
def register(body: RegisterBody, db: DBSession = Depends(get_db)):
    email = body.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Email invalide.")
    if len(body.password) < 6:
        raise HTTPException(400, "Mot de passe trop court (min. 6 caractères).")
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "Cet email est déjà utilisé.")

    user = User(email=email, hashed_password=hash_password(body.password))
    db.add(user)
    db.flush()
    sub = Subscription(user_id=user.id)
    db.add(sub)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    _send_email(email, "Bienvenue sur FormelyAI ! 🎉", _welcome_email_html(email))
    response = JSONResponse(_user_info(user))
    _set_auth_cookie(response, token)
    return response


@app.post("/auth/login")
def login(body: LoginBody, db: DBSession = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(401, "Email ou mot de passe incorrect.")

    token = create_access_token(user.id)
    response = JSONResponse(_user_info(user))
    _set_auth_cookie(response, token)
    return response


class GoogleLoginBody(BaseModel):
    credential: str   # JWT id_token from Google Identity Services


@app.post("/auth/google")
def google_login(body: GoogleLoginBody, db: DBSession = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(503, "Google OAuth non configuré.")
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as grequests
        idinfo = id_token.verify_oauth2_token(body.credential, grequests.Request(), GOOGLE_CLIENT_ID)
    except Exception as e:
        raise HTTPException(401, f"Token Google invalide : {e}")

    google_id = idinfo["sub"]
    email = idinfo.get("email", "").lower().strip()
    if not email:
        raise HTTPException(400, "Email manquant dans le token Google.")

    # Find or create user
    user = db.query(User).filter(User.google_id == google_id).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
        if user:
            # Link Google ID to existing email account
            user.google_id = google_id
        else:
            # New account via Google
            user = User(email=email, google_id=google_id, hashed_password=None)
            db.add(user)
            db.flush()
            sub = Subscription(user_id=user.id)
            db.add(sub)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    response = JSONResponse(_user_info(user))
    _set_auth_cookie(response, token)
    return response


class ForgotPasswordBody(BaseModel):
    email: str

class ResetPasswordBody(BaseModel):
    token: str
    password: str

@app.post("/auth/forgot-password")
def forgot_password(body: ForgotPasswordBody, db: DBSession = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        # Invalidate previous tokens
        db.query(PasswordResetToken).filter(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used == False,
        ).update({"used": True})
        token = secrets.token_urlsafe(32)
        db.add(PasswordResetToken(
            user_id=user.id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        ))
        db.commit()
        reset_url = f"{APP_URL}/?reset_token={token}"
        _send_email(email, "Réinitialisation de ton mot de passe — FormelyAI", _reset_email_html(reset_url))
    # Always return success to avoid user enumeration
    return {"detail": "Si cet email existe, un lien a été envoyé."}


@app.post("/auth/reset-password")
def reset_password(body: ResetPasswordBody, db: DBSession = Depends(get_db)):
    if len(body.password) < 6:
        raise HTTPException(400, "Mot de passe trop court (min. 6 caractères).")
    token_obj = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == body.token,
        PasswordResetToken.used == False,
        PasswordResetToken.expires_at > datetime.utcnow(),
    ).first()
    if not token_obj:
        raise HTTPException(400, "Lien invalide ou expiré.")
    user = db.query(User).filter(User.id == token_obj.user_id).first()
    if not user:
        raise HTTPException(400, "Utilisateur introuvable.")
    user.hashed_password = hash_password(body.password)
    token_obj.used = True
    db.commit()
    return {"detail": "Mot de passe mis à jour."}


@app.post("/auth/logout")
def logout():
    response = JSONResponse({"detail": "Déconnecté."})
    response.delete_cookie("access_token")
    return response


@app.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return _user_info(user)


# ---------------------------------------------------------------------------
# Routes – Billing (Stripe)
# ---------------------------------------------------------------------------

@app.post("/billing/subscribe")
def billing_subscribe(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    if not stripe.api_key:
        raise HTTPException(503, "Stripe non configuré.")

    sub = user.subscription
    customer_id = sub.stripe_customer_id if sub else None
    if not customer_id:
        customer = stripe.Customer.create(email=user.email)
        customer_id = customer.id
        if sub:
            sub.stripe_customer_id = customer_id
            db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRICE_MONTHLY, "quantity": 1}],
        mode="subscription",
        success_url=APP_URL + "/?subscribed=1",
        cancel_url=APP_URL + "/",
        metadata={"user_id": str(user.id), "type": "subscription"},
    )
    return {"url": session.url}


@app.post("/billing/credits")
def billing_credits(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    if not stripe.api_key:
        raise HTTPException(503, "Stripe non configuré.")

    sub = user.subscription
    customer_id = sub.stripe_customer_id if sub else None
    if not customer_id:
        customer = stripe.Customer.create(email=user.email)
        customer_id = customer.id
        if sub:
            sub.stripe_customer_id = customer_id
            db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRICE_CREDITS, "quantity": 1}],
        mode="payment",
        success_url=APP_URL + "/?credits=1",
        cancel_url=APP_URL + "/",
        metadata={"user_id": str(user.id), "type": "credits"},
    )
    return {"url": session.url}


@app.post("/billing/portal")
def billing_portal(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    if not stripe.api_key:
        raise HTTPException(503, "Stripe non configuré.")
    sub = user.subscription
    customer_id = sub.stripe_customer_id if sub else None
    if not customer_id:
        raise HTTPException(400, "Aucun abonnement Stripe trouvé.")
    session = stripe.billing_portal.Session.create(
        customer=customer_id,
        return_url=APP_URL + "/",
    )
    return {"url": session.url}


@app.post("/billing/webhook")
async def stripe_webhook(request: Request, db: DBSession = Depends(get_db)):
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        print(f"[WEBHOOK] Signature invalide : {e}")
        raise HTTPException(status_code=400, detail="Webhook invalide.")

    print(f"[WEBHOOK] Reçu : {event['type']} id={event['id']}")

    if event["type"] == "checkout.session.completed":
        cs = event["data"]["object"]
        meta = cs.get("metadata", {})
        user_id = int(meta.get("user_id", 0) or 0)
        event_type = meta.get("type", "")
        print(f"[WEBHOOK] checkout.session.completed user_id={user_id} type={event_type}")
        if user_id:
            user_obj = db.query(User).filter(User.id == user_id).first()
            if not user_obj:
                print(f"[WEBHOOK] ERREUR : user {user_id} introuvable")
            else:
                sub = user_obj.subscription
                if not sub:
                    sub = Subscription(user_id=user_obj.id)
                    db.add(sub)
                    db.flush()
                if event_type == "subscription":
                    sub.plan = "premium"
                    sub.stripe_subscription_id = cs.get("subscription")
                    sub.pdfs_used_this_month = 0
                    sub.period_start = datetime.utcnow()
                    print(f"[WEBHOOK] user {user_id} → premium activé")
                elif event_type == "credits":
                    sub.pdf_credits += 3
                    print(f"[WEBHOOK] user {user_id} → +3 crédits (total={sub.pdf_credits})")
                else:
                    print(f"[WEBHOOK] type inconnu : {event_type}")
                db.commit()

    elif event["type"] == "customer.subscription.deleted":
        stripe_sub_id = event["data"]["object"]["id"]
        sub = db.query(Subscription).filter(
            Subscription.stripe_subscription_id == stripe_sub_id
        ).first()
        if sub:
            sub.plan = "free"
            sub.stripe_subscription_id = None
            db.commit()

    return {"received": True}


# ---------------------------------------------------------------------------
# Routes – API
# ---------------------------------------------------------------------------

@app.post("/upload")
async def upload(
    file: Optional[UploadFile] = File(None),
    text: Optional[str] = Form(None),
    subject: str = Form("Général"),
    db: DBSession = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
):
    """Accept a PDF file OR pasted text, generate Q&A + summaries. Saves to DB only if logged in."""
    is_anonymous = user is None

    if not is_anonymous:
        _check_and_increment_quota(user, db)

    sub = user.subscription if user else None
    is_premium = user and (is_admin(user) or (sub and sub.plan == "premium"))
    max_pages = None if is_premium else FREE_MAX_PAGES
    max_qa    = None if is_premium else FREE_MAX_QA

    pages_extracted = pages_total = None

    if file and file.filename:
        raw_bytes = await file.read()
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Fichier vide.")
        if len(raw_bytes) > PDF_MAX_BYTES:
            raise HTTPException(status_code=413, detail="pdf_too_large")
        try:
            content, pages_extracted, pages_total = extract_text_from_pdf(raw_bytes, max_pages=max_pages)
        except Exception as e:
            raise HTTPException(status_code=422, detail=f"Impossible de lire le PDF : {e}")
        title = file.filename
    elif text and text.strip():
        content = text.strip()
        title = content[:60].replace("\n", " ") + ("…" if len(content) > 60 else "")
    else:
        raise HTTPException(status_code=400, detail="Fournissez un fichier PDF ou du texte.")

    if not content.strip():
        raise HTTPException(status_code=422, detail="Aucun texte extractible trouvé dans le PDF.")

    try:
        result = generate_qa_and_summaries(content, subject, max_qa=max_qa)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur lors de l'appel à l'IA : {e}")

    if not result.get("qa") and not result.get("summaries"):
        raise HTTPException(status_code=502, detail="L'IA n'a rien généré. Vérifie ta clé API ou réessaie.")

    # Appliquer la limite de fiches pour les gratuits
    qa_items = result.get("qa", [])
    if max_qa:
        qa_items = qa_items[:max_qa]

    summaries = result.get("summaries", [])

    # Anonyme : on retourne les résultats directement sans sauvegarder
    if is_anonymous:
        return {
            "session_id": None,
            "title": title,
            "qa_count": len(qa_items),
            "summary_count": len(summaries),
            "xp_events": [],
            "free_limit_applied": True,
            "pages_extracted": pages_extracted,
            "pages_total": pages_total,
            "anonymous": True,
            "qa_items": [{"question": q.get("question", ""), "answer": q.get("answer", "")} for q in qa_items],
            "summaries": [{"chapter_title": s.get("chapter_title", "Résumé"), "content": s.get("content", "")} for s in summaries],
        }

    session = Session(title=title, subject=subject, user_id=user.id)
    db.add(session)
    db.flush()

    for item in qa_items:
        qa = QA(
            session_id=session.id,
            question=item.get("question", ""),
            answer=item.get("answer", ""),
            review_count=0,
            next_review=datetime.utcnow(),
        )
        db.add(qa)

    for item in summaries:
        summary = Summary(
            session_id=session.id,
            chapter_title=item.get("chapter_title", "Résumé"),
            content=item.get("content", ""),
        )
        db.add(summary)

    db.commit()
    db.refresh(session)

    xp_events = _add_xp(user, XP_SESSION_AI, db, extra={"sessions_created": 1})
    return {
        "session_id": session.id,
        "title": session.title,
        "qa_count": len(qa_items),
        "summary_count": len(summaries),
        "xp_events": xp_events,
        "free_limit_applied": not is_premium,
        "pages_extracted": pages_extracted,
        "pages_total": pages_total,
    }


@app.get("/sessions", response_model=list[SessionOut])
def list_sessions(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    admin = is_admin(user)
    query = db.query(Session)
    if not admin:
        query = query.filter(Session.user_id == user.id)
    sessions = query.order_by(Session.created_at.desc()).all()

    if admin:
        user_ids = {s.user_id for s in sessions}
        users_map = {u.id: u.email for u in db.query(User).filter(User.id.in_(user_ids)).all()}

    now = datetime.utcnow()
    return [
        SessionOut(
            id=s.id,
            title=s.title,
            subject=s.subject,
            created_at=s.created_at,
            qa_count=len(s.qa_items),
            summary_count=len(s.summaries),
            is_public=s.is_public,
            due_count=sum(1 for q in s.qa_items if q.next_review <= now),
            owner_email=users_map.get(s.user_id) if admin else None,
        )
        for s in sessions
    ]


@app.get("/practice/cards", response_model=list[QAOut])
def get_practice_cards(
    sessions: str = Query(...),
    due_only: bool = Query(False),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    ids = [int(i) for i in sessions.split(",") if i.strip().isdigit()]
    if not ids:
        return []
    query = db.query(QA).join(Session).filter(
        Session.user_id == user.id,
        Session.id.in_(ids),
    )
    if due_only:
        query = query.filter(QA.next_review <= datetime.utcnow())
    return [QAOut.model_validate(q) for q in query.all()]


@app.get("/sessions/{session_id}", response_model=SessionDetail)
def get_session(session_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    s = db.query(Session).filter(Session.id == session_id, Session.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session introuvable.")
    return SessionDetail(
        id=s.id,
        title=s.title,
        subject=s.subject,
        created_at=s.created_at,
        qa_count=len(s.qa_items),
        summary_count=len(s.summaries),
        is_public=s.is_public,
        qa_items=[QAOut.model_validate(q) for q in s.qa_items],
        summaries=[SummaryOut.model_validate(sm) for sm in s.summaries],
    )


class RenameSessionBody(BaseModel):
    title: str

@app.patch("/sessions/{session_id}/rename")
def rename_session(session_id: int, body: RenameSessionBody, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    title = body.title.strip()
    if not title:
        raise HTTPException(400, "Le titre ne peut pas être vide.")
    s = db.query(Session).filter(Session.id == session_id, Session.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "Session introuvable.")
    s.title = title
    db.commit()
    return {"detail": "ok", "title": title}


@app.delete("/sessions/{session_id}")
def delete_session(session_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    s = db.query(Session).filter(Session.id == session_id, Session.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session introuvable.")
    db.delete(s)
    db.commit()
    return {"detail": "Session supprimée."}


@app.patch("/sessions/{session_id}/publish")
def toggle_publish(session_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    sub = user.subscription
    if not is_admin(user) and (not sub or sub.plan != "premium"):
        raise HTTPException(403, "premium_required")
    s = db.query(Session).filter(Session.id == session_id, Session.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "Session introuvable.")
    s.is_public = not s.is_public
    db.commit()
    events = {}
    if s.is_public:
        events = _add_xp(user, 10, db, extra={"shared": True})
    return {"is_public": s.is_public, **events}


@app.get("/library", response_model=list[PublicSessionOut])
def list_library(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    # All authenticated users can browse the library
    admin_user_ids = _get_admin_user_ids(db)

    sessions = (
        db.query(Session)
        .filter(
            Session.user_id != user.id,
            or_(
                Session.user_id.in_(admin_user_ids) if admin_user_ids else False,
                Session.is_public == True,
            ),
        )
        .order_by(
            # Admin decks first
            Session.user_id.in_(admin_user_ids).desc() if admin_user_ids else Session.created_at.desc(),
            Session.created_at.desc(),
        )
        .all()
    )
    return [
        PublicSessionOut(
            id=s.id,
            title=s.title,
            subject=s.subject,
            created_at=s.created_at,
            qa_count=len(s.qa_items),
            summary_count=len(s.summaries),
            author_email=s.user.email if s.user else "anonyme",
            is_admin_deck=bool(admin_user_ids and s.user_id in admin_user_ids),
        )
        for s in sessions
    ]


@app.post("/library/{session_id}/copy")
def copy_session(session_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    sub = user.subscription
    if not is_admin(user) and (not sub or sub.plan != "premium"):
        raise HTTPException(403, "premium_required")
    admin_user_ids = _get_admin_user_ids(db)
    src = db.query(Session).filter(
        Session.id == session_id,
        or_(
            Session.is_public == True,
            Session.user_id.in_(admin_user_ids) if admin_user_ids else False,
        ),
    ).first()
    if not src:
        raise HTTPException(404, "Session introuvable.")

    new_session = Session(
        title=src.title,
        subject=src.subject,
        user_id=user.id,
        is_public=False,
    )
    db.add(new_session)
    db.flush()

    for qa in src.qa_items:
        db.add(QA(
            session_id=new_session.id,
            question=qa.question,
            answer=qa.answer,
            review_count=0,
            next_review=datetime.utcnow(),
        ))
    for sm in src.summaries:
        db.add(Summary(
            session_id=new_session.id,
            chapter_title=sm.chapter_title,
            content=sm.content,
        ))

    db.commit()
    xp_events = _add_xp(user, XP_SESSION_MANUAL, db, extra={"sessions_created": 1})
    return {"session_id": new_session.id, "title": new_session.title, "xp_events": xp_events}


class ReviewBody(BaseModel):
    quality: int = 4  # 1=Again, 2=Hard, 4=Good, 5=Easy

@app.patch("/qa/{qa_id}/review")
def review_qa(qa_id: int, body: ReviewBody, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    qa = db.query(QA).join(Session).filter(QA.id == qa_id, Session.user_id == user.id).first()
    if not qa:
        raise HTTPException(status_code=404, detail="Carte introuvable.")
    quality = max(1, min(5, body.quality))
    sm2_schedule(qa, quality)
    xp_gain = XP_REVIEW if quality >= 2 else 0  # pas d'XP sur "À revoir"
    if xp_gain:
        db.add(ReviewLog(user_id=user.id, qa_id=qa.id, xp_gained=xp_gain))
    db.commit()
    db.refresh(qa)
    xp_events = _add_xp(user, xp_gain, db, extra={"cards_reviewed": 1}) if xp_gain else {}
    result = QAOut.model_validate(qa).model_dump()
    result["xp_events"] = xp_events
    return result


@app.post("/sessions/{session_id}/qa", response_model=QAOut)
def create_qa(session_id: int, body: QACreate, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    s = db.query(Session).filter(Session.id == session_id, Session.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session introuvable.")
    qa = QA(
        session_id=session_id,
        question=body.question.strip(),
        answer=body.answer.strip(),
        review_count=0,
        next_review=datetime.utcnow(),
    )
    db.add(qa)
    db.commit()
    db.refresh(qa)
    return QAOut.model_validate(qa)


@app.put("/qa/{qa_id}", response_model=QAOut)
def update_qa(qa_id: int, body: QAUpdate, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    qa = db.query(QA).join(Session).filter(QA.id == qa_id, Session.user_id == user.id).first()
    if not qa:
        raise HTTPException(status_code=404, detail="Carte introuvable.")
    if body.question is not None:
        qa.question = body.question.strip()
    if body.answer is not None:
        qa.answer = body.answer.strip()
    db.commit()
    db.refresh(qa)
    return QAOut.model_validate(qa)


@app.delete("/qa/{qa_id}")
def delete_qa(qa_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    qa = db.query(QA).join(Session).filter(QA.id == qa_id, Session.user_id == user.id).first()
    if not qa:
        raise HTTPException(status_code=404, detail="Carte introuvable.")
    db.delete(qa)
    db.commit()
    return {"detail": "Carte supprimée."}


@app.post("/sessions/manual")
def create_manual_session(
    title: str = Form(...),
    subject: str = Form("Général"),
    user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    session = Session(title=title, subject=subject, user_id=user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"session_id": session.id, "title": session.title}


class PracticeXPBody(BaseModel):
    correct: int
    total: int
    perfect: bool = False
    streak_10: bool = False
    streak_25: bool = False

@app.post("/xp/practice")
def practice_xp(body: PracticeXPBody, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    amount = body.correct * XP_PRACTICE_CARD + XP_PRACTICE_DONE
    # Log one entry per correct card reviewed
    for _ in range(body.correct):
        db.add(ReviewLog(user_id=user.id, qa_id=None, xp_gained=XP_PRACTICE_CARD))
    db.commit()
    return _add_xp(user, amount, db, extra={
        "cards_reviewed": body.correct,
        "perfect": body.perfect,
        "streak_10": body.streak_10,
        "streak_25": body.streak_25,
    })


@app.get("/stats/dashboard")
def stats_dashboard(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    from sqlalchemy import func, text

    sub = user.subscription
    is_premium = is_admin(user) or (sub and sub.plan == "premium")

    # KPIs (available to all)
    total_cards = db.query(func.count(QA.id)).join(Session).filter(Session.user_id == user.id).scalar() or 0
    total_decks = db.query(func.count(Session.id)).filter(Session.user_id == user.id).scalar() or 0
    total_reviews = db.query(func.count(ReviewLog.id)).filter(ReviewLog.user_id == user.id).scalar() or 0
    now = datetime.utcnow()
    due_count = (
        db.query(func.count(QA.id))
        .join(Session)
        .filter(Session.user_id == user.id, QA.next_review <= now)
        .scalar() or 0
    )

    # Charts (premium only — returns empty arrays for free)
    reviews_per_day = []
    xp_over_time = []
    if is_premium:
        since = now - timedelta(days=30)
        rows = (
            db.query(
                func.date_trunc("day", ReviewLog.reviewed_at).label("day"),
                func.count(ReviewLog.id).label("cnt"),
            )
            .filter(ReviewLog.user_id == user.id, ReviewLog.reviewed_at >= since)
            .group_by("day")
            .order_by("day")
            .all()
        )
        reviews_per_day = [{"date": r.day.strftime("%Y-%m-%d"), "count": r.cnt} for r in rows]

        # Cumulative XP approximation: daily xp_gained sum
        xp_rows = (
            db.query(
                func.date_trunc("day", ReviewLog.reviewed_at).label("day"),
                func.sum(ReviewLog.xp_gained).label("xp"),
            )
            .filter(ReviewLog.user_id == user.id, ReviewLog.reviewed_at >= since)
            .group_by("day")
            .order_by("day")
            .all()
        )
        cumul = 0
        for r in xp_rows:
            cumul += int(r.xp or 0)
            xp_over_time.append({"date": r.day.strftime("%Y-%m-%d"), "xp": cumul})

    # Subject breakdown (all users)
    sessions = db.query(Session).filter(Session.user_id == user.id).all()
    subjects: dict[str, dict] = {}
    for s in sessions:
        subj = s.subject or "Général"
        if subj not in subjects:
            subjects[subj] = {"decks": 0, "cards": 0, "due": 0}
        subjects[subj]["decks"] += 1
        subjects[subj]["cards"] += len(s.qa_items)
        subjects[subj]["due"] += sum(1 for q in s.qa_items if q.next_review <= now)

    # Due cards per deck (top 10 by due count)
    due_by_deck = sorted(
        [{"title": s.title, "subject": s.subject or "Général", "due": sum(1 for q in s.qa_items if q.next_review <= now), "total": len(s.qa_items)}
         for s in sessions if s.qa_items],
        key=lambda x: -x["due"]
    )[:10]

    return {
        "is_premium": is_premium,
        "kpis": {
            "total_cards": total_cards,
            "total_decks": total_decks,
            "total_reviews": total_reviews,
            "due_count": due_count,
        },
        "reviews_per_day": reviews_per_day,
        "xp_over_time": xp_over_time,
        "subjects": [{"name": k, **v} for k, v in subjects.items()],
        "due_by_deck": due_by_deck,
        "xp": (sub.xp or 0) if sub else 0,
        "level": xp_to_level((sub.xp or 0) if sub else 0),
    }


@app.get("/export/{session_id}/csv")
def export_csv(session_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    s = db.query(Session).filter(Session.id == session_id, Session.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session introuvable.")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Question", "Réponse", "Revues", "Prochaine révision"])
    for qa in s.qa_items:
        writer.writerow([
            qa.question,
            qa.answer,
            qa.review_count,
            qa.next_review.strftime("%Y-%m-%d") if qa.next_review else "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=session_{session_id}_qa.csv"},
    )


@app.get("/export/{session_id}/anki")
def export_anki(session_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    sub = user.subscription
    if not is_admin(user) and (not sub or sub.plan != "premium"):
        raise HTTPException(403, "premium_required")

    s = db.query(Session).filter(Session.id == session_id, Session.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "Session introuvable.")

    import genanki

    model = genanki.Model(
        random.randrange(1 << 30, 1 << 31),
        "FormelyAI",
        fields=[{"name": "Question"}, {"name": "Answer"}],
        templates=[{
            "name": "Card 1",
            "qfmt": "{{Question}}",
            "afmt": "{{FrontSide}}<hr id=answer>{{Answer}}",
        }],
    )
    deck = genanki.Deck(random.randrange(1 << 30, 1 << 31), s.title)
    for qa in s.qa_items:
        deck.add_note(genanki.Note(model=model, fields=[qa.question, qa.answer]))

    with tempfile.NamedTemporaryFile(suffix=".apkg", delete=False) as f:
        tmp_path = f.name
    genanki.Package(deck).write_to_file(tmp_path)

    return FileResponse(
        tmp_path,
        media_type="application/octet-stream",
        filename=f"session_{session_id}.apkg",
    )


@app.get("/export/{session_id}/pdf")
def export_pdf(session_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    sub = user.subscription
    if not is_admin(user) and (not sub or sub.plan != "premium"):
        raise HTTPException(403, "premium_required")

    s = db.query(Session).filter(Session.id == session_id, Session.user_id == user.id).first()
    if not s:
        raise HTTPException(404, "Session introuvable.")

    from fpdf import FPDF

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, s.title, new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 6, f"{s.subject or 'General'} · {s.created_at.strftime('%d/%m/%Y')}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(5)

    # Q&A section
    if s.qa_items:
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 10, "Questions / Reponses", new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(200, 200, 200)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(3)

        for i, qa in enumerate(s.qa_items, 1):
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(80, 50, 180)
            pdf.multi_cell(0, 6, f"Q{i}: {qa.question}")
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(50, 50, 50)
            pdf.multi_cell(0, 6, f"  -> {qa.answer}")
            pdf.ln(2)

    # Summaries section
    if s.summaries:
        pdf.add_page()
        pdf.set_font("Helvetica", "B", 13)
        pdf.set_text_color(0, 0, 0)
        pdf.cell(0, 10, "Resumes", new_x="LMARGIN", new_y="NEXT")
        pdf.set_draw_color(200, 200, 200)
        pdf.line(10, pdf.get_y(), 200, pdf.get_y())
        pdf.ln(3)

        for sm in s.summaries:
            pdf.set_font("Helvetica", "B", 11)
            pdf.set_text_color(80, 50, 180)
            pdf.cell(0, 8, sm.chapter_title, new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(50, 50, 50)
            pdf.multi_cell(0, 6, sm.content)
            pdf.ln(3)

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as f:
        tmp_path = f.name
    pdf.output(tmp_path)

    return FileResponse(
        tmp_path,
        media_type="application/pdf",
        filename=f"session_{session_id}.pdf",
    )
