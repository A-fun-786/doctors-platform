"""API route handlers."""
from app.api.routes import health, auth, doctor, public, schedule, appointment, app_build

__all__ = ["health", "auth", "doctor", "public", "schedule", "appointment", "app_build"]
