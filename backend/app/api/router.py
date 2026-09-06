from fastapi import APIRouter
from app.api.routes import health, auth, doctor, public

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(auth.router)
api_router.include_router(doctor.router)
api_router.include_router(public.router)
