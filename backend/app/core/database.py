from typing import Generator
from sqlalchemy import create_engine, inspect, text
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
    if settings.DATABASE_URL.startswith("sqlite"):
        with engine.connect() as conn:
            inspector = inspect(engine)
            if "doctors" in inspector.get_table_names():
                doc_cols = {col["name"] for col in inspector.get_columns("doctors")}
                if "speciality" not in doc_cols:
                    conn.execute(text("ALTER TABLE doctors ADD COLUMN speciality VARCHAR(255)"))
                if "bio" not in doc_cols:
                    conn.execute(text("ALTER TABLE doctors ADD COLUMN bio TEXT"))
                if "onboarding_completed" not in doc_cols:
                    conn.execute(text("ALTER TABLE doctors ADD COLUMN onboarding_completed BOOLEAN DEFAULT 0 NOT NULL"))

            if "tenants" in inspector.get_table_names():
                tenant_cols = {col["name"] for col in inspector.get_columns("tenants")}
                if "clinic_name" not in tenant_cols:
                    conn.execute(text("ALTER TABLE tenants ADD COLUMN clinic_name VARCHAR(255)"))
                if "location" not in tenant_cols:
                    conn.execute(text("ALTER TABLE tenants ADD COLUMN location VARCHAR(500)"))
                if "service_appointment" not in tenant_cols:
                    conn.execute(text("ALTER TABLE tenants ADD COLUMN service_appointment BOOLEAN DEFAULT 1 NOT NULL"))
                if "service_video_consultation" not in tenant_cols:
                    conn.execute(text("ALTER TABLE tenants ADD COLUMN service_video_consultation BOOLEAN DEFAULT 1 NOT NULL"))
                if "service_medicine_inventory" not in tenant_cols:
                    conn.execute(text("ALTER TABLE tenants ADD COLUMN service_medicine_inventory BOOLEAN DEFAULT 0 NOT NULL"))
                if "service_lab_reports" not in tenant_cols:
                    conn.execute(text("ALTER TABLE tenants ADD COLUMN service_lab_reports BOOLEAN DEFAULT 0 NOT NULL"))
            conn.commit()
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
