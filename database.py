import os
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.orm import declarative_base, sessionmaker, relationship
from datetime import datetime

DATABASE_URL = os.environ["DATABASE_URL"]

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)   # nullable for Google-only accounts
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("Session", back_populates="user", cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    plan = Column(String(50), default="free")           # "free" | "premium"
    stripe_customer_id = Column(String(255), nullable=True)
    stripe_subscription_id = Column(String(255), nullable=True)
    pdf_credits = Column(Integer, default=0)            # extra bought credits
    pdfs_used_this_month = Column(Integer, default=0)
    period_start = Column(DateTime, default=datetime.utcnow)
    # Gamification
    xp = Column(Integer, default=0)
    cards_reviewed = Column(Integer, default=0)
    sessions_created = Column(Integer, default=0)
    perfect_count = Column(Integer, default=0)
    badges = Column(Text, default="[]")

    user = relationship("User", back_populates="subscription")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="sessions")
    qa_items = relationship("QA", back_populates="session", cascade="all, delete-orphan")
    summaries = relationship("Summary", back_populates="session", cascade="all, delete-orphan")


class QA(Base):
    __tablename__ = "qa_items"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    review_count = Column(Integer, default=0)
    ease_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=0)
    next_review = Column(DateTime, default=datetime.utcnow)
    last_reviewed = Column(DateTime, nullable=True)

    session = relationship("Session", back_populates="qa_items")


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("sessions.id"), nullable=False)
    chapter_title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)

    session = relationship("Session", back_populates="summaries")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)


class ReviewLog(Base):
    __tablename__ = "review_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    qa_id = Column(Integer, ForeignKey("qa_items.id"), nullable=True)
    reviewed_at = Column(DateTime, default=datetime.utcnow, index=True)
    xp_gained = Column(Integer, default=0)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    Base.metadata.create_all(bind=engine)
    _migrate()


def _migrate():
    """Add columns that may be missing from existing tables (idempotent)."""
    from sqlalchemy import text
    with engine.connect() as conn:
        for stmt in [
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id)",
            "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE",
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS xp INTEGER DEFAULT 0",
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS cards_reviewed INTEGER DEFAULT 0",
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS sessions_created INTEGER DEFAULT 0",
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS badges TEXT DEFAULT '[]'",
            "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS perfect_count INTEGER DEFAULT 0",
            "ALTER TABLE qa_items ADD COLUMN IF NOT EXISTS ease_factor FLOAT DEFAULT 2.5",
            "ALTER TABLE qa_items ADD COLUMN IF NOT EXISTS interval INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE",
            "ALTER TABLE users ALTER COLUMN hashed_password DROP NOT NULL",
            "CREATE TABLE IF NOT EXISTS review_logs (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), qa_id INTEGER REFERENCES qa_items(id), reviewed_at TIMESTAMP DEFAULT NOW(), xp_gained INTEGER DEFAULT 0)",
            "CREATE INDEX IF NOT EXISTS ix_review_logs_reviewed_at ON review_logs(reviewed_at)",
            "CREATE TABLE IF NOT EXISTS password_reset_tokens (id SERIAL PRIMARY KEY, user_id INTEGER REFERENCES users(id), token VARCHAR(255) UNIQUE NOT NULL, expires_at TIMESTAMP NOT NULL, used BOOLEAN DEFAULT FALSE)",
        ]:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                conn.rollback()
