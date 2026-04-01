import io
import csv
import os
import random
import tempfile
from datetime import datetime, timedelta
from dotenv import load_dotenv
load_dotenv()
from typing import Optional

import pdfplumber
import stripe
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session as DBSession
from pydantic import BaseModel

from database import get_db, init_db, Session, QA, Summary, User, Subscription
from ai_service import generate_qa_and_summaries
from auth import hash_password, verify_password, create_access_token, get_current_user

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

# Spaced repetition intervals (days)
SR_INTERVALS = [1, 3, 7, 14, 30, 60]
FREE_UPLOAD_LIMIT = 1
PREMIUM_MONTHLY_LIMIT = 40


@app.on_event("startup")
def startup():
    init_db()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def extract_text_from_pdf(file_bytes: bytes) -> str:
    parts = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                parts.append(t)
    return "\n\n".join(parts)


def next_review_date(review_count: int) -> datetime:
    idx = min(review_count, len(SR_INTERVALS) - 1)
    return datetime.utcnow() + timedelta(days=SR_INTERVALS[idx])


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
    plan = sub.plan if sub else "free"
    pdfs_used = sub.pdfs_used_this_month if sub else 0
    monthly_limit = PREMIUM_MONTHLY_LIMIT if plan == "premium" else FREE_UPLOAD_LIMIT
    pdf_credits = sub.pdf_credits if sub else 0
    return {
        "id": user.id,
        "email": user.email,
        "plan": plan,
        "pdfs_used": pdfs_used,
        "monthly_limit": monthly_limit,
        "pdf_credits": pdf_credits,
    }


def _check_and_increment_quota(user: User, db: DBSession):
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
        if sub.pdfs_used_this_month >= FREE_UPLOAD_LIMIT:
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

    class Config:
        from_attributes = True


class SessionDetail(SessionOut):
    qa_items: list[QAOut]
    summaries: list[SummaryOut]


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


@app.post("/billing/webhook")
async def stripe_webhook(request: Request, db: DBSession = Depends(get_db)):
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(body, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(status_code=400, detail="Webhook invalide.")

    if event["type"] == "checkout.session.completed":
        cs = event["data"]["object"]
        meta = cs.get("metadata", {})
        user_id = int(meta.get("user_id", 0) or 0)
        event_type = meta.get("type", "")
        if user_id:
            user_obj = db.query(User).filter(User.id == user_id).first()
            if user_obj and user_obj.subscription:
                sub = user_obj.subscription
                if event_type == "subscription":
                    sub.plan = "premium"
                    sub.stripe_subscription_id = cs.get("subscription")
                    sub.pdfs_used_this_month = 0
                    sub.period_start = datetime.utcnow()
                elif event_type == "credits":
                    sub.pdf_credits += 5
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
    user: User = Depends(get_current_user),
):
    """Accept a PDF file OR pasted text, generate Q&A + summaries, persist, return session_id."""
    _check_and_increment_quota(user, db)

    if file and file.filename:
        raw_bytes = await file.read()
        if not raw_bytes:
            raise HTTPException(status_code=400, detail="Fichier vide.")
        try:
            content = extract_text_from_pdf(raw_bytes)
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
        result = generate_qa_and_summaries(content, subject)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Erreur lors de l'appel à l'IA : {e}")

    session = Session(title=title, subject=subject, user_id=user.id)
    db.add(session)
    db.flush()

    for item in result.get("qa", []):
        qa = QA(
            session_id=session.id,
            question=item.get("question", ""),
            answer=item.get("answer", ""),
            review_count=0,
            next_review=datetime.utcnow(),
        )
        db.add(qa)

    for item in result.get("summaries", []):
        summary = Summary(
            session_id=session.id,
            chapter_title=item.get("chapter_title", "Résumé"),
            content=item.get("content", ""),
        )
        db.add(summary)

    db.commit()
    db.refresh(session)

    return {
        "session_id": session.id,
        "title": session.title,
        "qa_count": len(result.get("qa", [])),
        "summary_count": len(result.get("summaries", [])),
    }


@app.get("/sessions", response_model=list[SessionOut])
def list_sessions(user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    sessions = (
        db.query(Session)
        .filter(Session.user_id == user.id)
        .order_by(Session.created_at.desc())
        .all()
    )
    return [
        SessionOut(
            id=s.id,
            title=s.title,
            subject=s.subject,
            created_at=s.created_at,
            qa_count=len(s.qa_items),
            summary_count=len(s.summaries),
        )
        for s in sessions
    ]


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
        qa_items=[QAOut.model_validate(q) for q in s.qa_items],
        summaries=[SummaryOut.model_validate(sm) for sm in s.summaries],
    )


@app.delete("/sessions/{session_id}")
def delete_session(session_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    s = db.query(Session).filter(Session.id == session_id, Session.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Session introuvable.")
    db.delete(s)
    db.commit()
    return {"detail": "Session supprimée."}


@app.patch("/qa/{qa_id}/review")
def review_qa(qa_id: int, user: User = Depends(get_current_user), db: DBSession = Depends(get_db)):
    qa = db.query(QA).join(Session).filter(QA.id == qa_id, Session.user_id == user.id).first()
    if not qa:
        raise HTTPException(status_code=404, detail="Carte introuvable.")
    qa.review_count += 1
    qa.last_reviewed = datetime.utcnow()
    qa.next_review = next_review_date(qa.review_count)
    db.commit()
    db.refresh(qa)
    return QAOut.model_validate(qa)


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
    if not sub or sub.plan != "premium":
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
    if not sub or sub.plan != "premium":
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
