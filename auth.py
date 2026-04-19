import os
import hashlib
import hmac
import base64
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, Cookie
from jose import JWTError, jwt
from sqlalchemy.orm import Session as DBSession

from database import get_db, User

SECRET_KEY = os.environ.get("SECRET_KEY", "change-this-secret-key-in-production")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

_ITERATIONS = 260_000


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(32)
    key = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return base64.b64encode(salt + key).decode()


def verify_password(plain: str, hashed: str) -> bool:
    try:
        data = base64.b64decode(hashed.encode())
        salt, stored = data[:32], data[32:]
        key = hashlib.pbkdf2_hmac("sha256", plain.encode(), salt, _ITERATIONS)
        return hmac.compare_digest(key, stored)
    except Exception:
        return False


def create_access_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
    db: DBSession = Depends(get_db),
) -> User:
    if not access_token:
        raise HTTPException(status_code=401, detail="Non authentifié.")
    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, Exception):
        raise HTTPException(status_code=401, detail="Token invalide.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable.")
    return user


def get_optional_user(
    access_token: Optional[str] = Cookie(default=None),
    db: DBSession = Depends(get_db),
) -> Optional[User]:
    if not access_token:
        return None
    try:
        payload = jwt.decode(access_token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None
