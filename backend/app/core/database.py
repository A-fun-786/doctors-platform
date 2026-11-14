from typing import Generator
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import OperationalError
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from app.core.config import get_settings

from app.models.base import Base
import app.models  # noqa: F401 — Ensure all models are registered

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_size=3,
    max_overflow=5,
    pool_recycle=300,
    connect_args=connect_args,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)


def init_db() -> None:
    """Create all registered database tables (for local development/testing)."""
    Base.metadata.create_all(bind=engine)


@retry(
    reraise=True,
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=0.1, min=0.1, max=1.0),
    retry=retry_if_exception_type(OperationalError),
)
def create_session_with_retry() -> Session:
    """Create a database session with retry on transient OperationalError."""
    session = SessionLocal()
    session.execute(text("SELECT 1"))
    return session


def get_db() -> Generator[Session, None, None]:
    """Dependency that provides a database session and ensures closure."""
    db = create_session_with_retry()
    try:
        yield db
    finally:
        db.close()

