from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.logging import get_logger

router = APIRouter(prefix="/health", tags=["Health"])
settings = get_settings()
logger = get_logger("health")


@router.get("", summary="API Health Check")
def health_check():
    """Returns general API health and observability configuration status."""
    return {
        "status": "healthy",
        "service": "doctor-platform-api",
        "environment": settings.ENVIRONMENT,
        "sentry_enabled": bool(settings.SENTRY_DSN and settings.SENTRY_DSN.strip()),
        "rate_limiting_enabled": True,
        "version": "0.1.0",
    }


@router.get("/database", summary="Database Connectivity Check")
def database_health_check(db: Session = Depends(get_db)):
    """Verifies active connectivity to the PostgreSQL database."""
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "healthy",
            "database": "connected",
        }
    except Exception as exc:
        logger.error("database_health_check_failed", error=str(exc))
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(exc),
            },
        )

