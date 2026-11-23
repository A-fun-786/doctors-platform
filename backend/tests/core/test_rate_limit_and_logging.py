
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging
from app.core.sentry import init_sentry


def test_health_check_observability_fields(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "doctor-platform-api"
    assert "environment" in data
    assert "sentry_enabled" in data
    assert data["rate_limiting_enabled"] is True
    assert data["version"] == "0.1.0"


def test_auth_login_rate_limiting_triggers_429(client):
    # RATE_LIMIT_AUTH is 5/minute, so 5 requests should pass to route logic and 6th must return 429
    responses = []
    for _ in range(6):
        res = client.post(
            "/api/v1/auth/login",
            json={"email": "ratelimit-test@test.com", "password": "wrongpassword123"},
        )
        responses.append(res.status_code)

    # First 5 should be 401 Unauthorized (because bad credentials), 6th must be 429 Too Many Requests
    assert responses[:5] == [401, 401, 401, 401, 401]
    assert responses[5] == 429

    # Additional requests should continue to return 429
    res_429 = client.post(
        "/api/v1/auth/login",
        json={"email": "ratelimit-test@test.com", "password": "wrongpassword123"},
    )
    assert res_429.status_code == 429
    data = res_429.json()
    assert "Rate limit exceeded" in data.get("error", "")
    assert "Rate limit exceeded" in data.get("detail", "")


def test_sentry_init_with_empty_dsn():
    """Ensure init_sentry returns False and does not raise exception when DSN is empty."""
    settings = get_settings()
    original_dsn = settings.SENTRY_DSN
    try:
        settings.SENTRY_DSN = ""
        assert init_sentry() is False
    finally:
        settings.SENTRY_DSN = original_dsn


def test_logger_setup_and_levels():
    """Ensure setup_logging and get_logger configure and return bound structlog loggers."""
    logger = setup_logging()
    assert logger is not None

    test_logger = get_logger("test_unit")
    assert test_logger is not None
    # Verify logging at info and warning levels does not raise errors
    test_logger.info("test_info_event", metric=123)
    test_logger.warning("test_warning_event", reason="testing")

