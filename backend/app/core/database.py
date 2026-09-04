from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import get_settings

from app.models.base import Base
import app.models  # Ensure all models are registered

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    connect_args=connect_args,
)

# Auto-create tables for development convenience (especially when using SQLite)
try:
    Base.metadata.create_all(bind=engine)
except Exception:
    pass

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a database session and ensures closure."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
