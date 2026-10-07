# ─────────────────────────────────────────────
# X-Guardian — SQLite Database Engine & Session
# ─────────────────────────────────────────────

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Path to database file inside backend/ directory
DB_DIR = Path(__file__).resolve().parent.parent
DB_FILE = DB_DIR / "xguardian.db"
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_FILE}"

# Engine with check_same_thread=False for SQLite in multithreaded FastAPI
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency for yielding database session with automatic cleanup."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
