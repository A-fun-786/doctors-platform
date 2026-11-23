from fastapi import Request, Response
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger("rate_limit")

def get_client_ip(request: Request) -> str:
    """
    Extract the client IP address considering trusted reverse proxy headers
    (X-Forwarded-For, X-Real-IP), falling back to request.client.host.
    When TRUSTED_PROXY_COUNT > 0 (default 1 in production), selects the rightmost
    untrusted hop to prevent client X-Forwarded-For spoofing.
    """
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        hops = [ip.strip() for ip in forwarded_for.split(",") if ip.strip()]
        if hops:
            trusted_count = int(getattr(get_settings(), "TRUSTED_PROXY_COUNT", 0) or 0)
            if trusted_count > 0:
                idx = max(0, len(hops) - trusted_count)
                return hops[idx]
            return hops[0]

    real_ip = request.headers.get("X-Real-IP")
    if real_ip and real_ip.strip():
        return real_ip.strip()

    if request.client and request.client.host:
        return request.client.host

    return "127.0.0.1"


# Central Limiter instance keyed by client IP address (supports optional REDIS_URL for multi-worker scaling)
limiter = Limiter(
    key_func=get_client_ip,
    default_limits=[settings.RATE_LIMIT_GLOBAL],
    storage_uri=settings.REDIS_URL.strip() if settings.REDIS_URL and settings.REDIS_URL.strip() else "memory://",
)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> Response:
    """
    Handles RateLimitExceeded exceptions across all endpoints.
    Logs security warnings for brute-force or abuse detection,
    and returns a structured 429 response with rate limit headers.
    """
    client_ip = get_client_ip(request)
    logger.warning(
        "rate_limit_exceeded",
        client_ip=client_ip,
        path=request.url.path,
        method=request.method,
        detail=str(exc.detail),
    )

    response = JSONResponse(
        content={
            "error": "Rate limit exceeded",
            "detail": f"Rate limit exceeded: {exc.detail}",
        },
        status_code=429,
    )

    if hasattr(request.app.state, "limiter") and hasattr(request.state, "view_rate_limit"):
        response = request.app.state.limiter._inject_headers(
            response, request.state.view_rate_limit
        )

    return response

