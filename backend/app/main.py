import uuid
from contextlib import asynccontextmanager
from pathlib import Path
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import structlog

try:
    import sentry_sdk
except ImportError:
    sentry_sdk = None


from app.api.router import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging, get_logger
from app.core.rate_limit import limiter, rate_limit_exceeded_handler, get_client_ip
from app.core.sentry import init_sentry

# Initialize structured logging and Sentry prior to app bootstrap
setup_logging()
init_sentry()

logger = get_logger("http")
settings = get_settings()

is_production = settings.ENVIRONMENT.lower() == "production"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and graceful shutdown."""
    yield
    # Graceful shutdown: drain DB engine pool and flush Sentry telemetry
    logger.info("server_shutdown_starting", message="Draining database connection pool and flushing telemetry")
    try:
        from app.core.database import engine
        engine.dispose()
    except Exception as e:
        logger.warning("db_engine_dispose_failed", error=str(e))
    try:
        if sentry_sdk and hasattr(sentry_sdk, "flush"):
            sentry_sdk.flush(timeout=2.0)
    except Exception:
        pass
    logger.info("server_shutdown_complete")


app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API foundation for the Multi-Tenant Doctor Platform",
    version="0.1.0",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
    lifespan=lifespan,
)

# Attach SlowAPI Limiter state and error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] if is_production else ["*"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With", "X-Request-Id", "Idempotency-Key"] if is_production else ["*"],
)


@app.middleware("http")
async def request_lifecycle_middleware(request: Request, call_next):
    """
    HTTP middleware managing:
    1. Request-ID correlation propagation (X-Request-Id header, structlog contextvars, Sentry tagging).
    2. Request logging with duration, status, and client IP.
    3. Security headers injection (X-Content-Type-Options, X-Frame-Options, HSTS, etc.).
    """
    request_id = request.headers.get("X-Request-Id") or uuid.uuid4().hex
    request.state.request_id = request_id
    structlog.contextvars.bind_contextvars(request_id=request_id)
    if sentry_sdk and hasattr(sentry_sdk, "set_tag"):
        sentry_sdk.set_tag("request_id", request_id)

    start_time = time.perf_counter()
    try:
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        client_ip = get_client_ip(request)

        log_data = {
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "client_ip": client_ip,
        }

        if response.status_code >= 500:
            logger.error("http_request_server_error", **log_data)
        elif response.status_code >= 400:
            logger.warning("http_request_client_error", **log_data)
        else:
            logger.info("http_request_success", **log_data)

        # Standard production security and correlation headers
        response.headers["X-Request-Id"] = request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if is_production or request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        client_ip = get_client_ip(request)
        logger.error(
            "http_request_unhandled_exception",
            request_id=request_id,
            method=request.method,
            path=request.url.path,
            duration_ms=duration_ms,
            client_ip=client_ip,
            error=str(exc),
            exc_info=True,
        )
        raise exc
    finally:
        structlog.contextvars.clear_contextvars()



@app.get("/health", tags=["Health"], summary="Root Health Check")
def root_health():
    """Root health check endpoint."""
    return {"status": "healthy"}


# Mount versioned API routes
app.include_router(api_router)

# Mount local uploads directory for file serving
uploads_path = Path(settings.STORAGE_LOCAL_DIR).resolve()
uploads_path.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

