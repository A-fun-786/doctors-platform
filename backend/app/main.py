from pathlib import Path
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware


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

app = FastAPI(
    title=settings.APP_NAME,
    description="Backend API foundation for the Multi-Tenant Doctor Platform",
    version="0.1.0",
    docs_url=None if is_production else "/docs",
    redoc_url=None if is_production else "/redoc",
    openapi_url=None if is_production else "/openapi.json",
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
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"] if is_production else ["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    """
    HTTP middleware logging request lifecycle with duration, status, and client IP.
    Separates log levels appropriately:
    - 2xx/3xx -> INFO
    - 4xx (client errors, rate limits, bad auth) -> WARNING
    - 5xx / unhandled exceptions -> ERROR
    """
    start_time = time.perf_counter()
    try:
        response = await call_next(request)
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        client_ip = get_client_ip(request)

        log_data = {
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

        return response
    except Exception as exc:
        duration_ms = round((time.perf_counter() - start_time) * 1000, 2)
        client_ip = get_client_ip(request)
        logger.error(
            "http_request_unhandled_exception",
            method=request.method,
            path=request.url.path,
            duration_ms=duration_ms,
            client_ip=client_ip,
            error=str(exc),
            exc_info=True,
        )
        raise exc


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

