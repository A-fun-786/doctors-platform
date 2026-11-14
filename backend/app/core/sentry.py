import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

from app.core.config import get_settings
from app.core.logging import get_logger

settings = get_settings()
logger = get_logger("sentry")


def init_sentry() -> bool:
    """
    Initializes Sentry SDK for centralized error tracking, crash reporting, and APM.
    Safe to execute in any environment: if SENTRY_DSN is absent, it logs information
    and exits cleanly without crashing startup.

    HIPAA-conscious posture:
    - send_default_pii=False prevents automatic capture of headers, user IP, or cookies in Sentry events.
    """
    if not settings.SENTRY_DSN or not settings.SENTRY_DSN.strip():
        logger.info(
            "sentry_disabled",
            message="SENTRY_DSN not configured; central error tracking is disabled.",
        )
        return False

    try:
        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
            send_default_pii=False,
            integrations=[
                FastApiIntegration(),
                SqlalchemyIntegration(),
            ],
        )
        logger.info(
            "sentry_initialized",
            environment=settings.ENVIRONMENT,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            profiles_sample_rate=settings.SENTRY_PROFILES_SAMPLE_RATE,
        )
        return True
    except Exception as exc:
        logger.error(
            "sentry_initialization_failed",
            error=str(exc),
            exc_info=True,
        )
        return False

