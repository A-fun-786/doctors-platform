from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import get_db

router = APIRouter(prefix="/health", tags=["Health"])


@router.get("", summary="API Health Check")
def health_check():
    """Returns general API health status."""
    return {
        "status": "healthy",
        "service": "doctor-platform-api",
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
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(exc),
            },
        )
