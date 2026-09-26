import logging
import sys
from typing import Optional
import structlog
from app.core.config import get_settings


def setup_logging() -> structlog.stdlib.BoundLogger:
    """
    Configures structured logging across the application.
    Supports JSON formatting for production observability and colored console output for local development.
    Separates log levels appropriately (DEBUG, INFO, WARNING, ERROR, CRITICAL).
    """
    settings = get_settings()
    log_level_name = settings.LOG_LEVEL.upper()
    log_level = getattr(logging, log_level_name, logging.INFO)

    use_json = settings.LOG_FORMAT.lower() == "json" or settings.ENVIRONMENT.lower() == "production"

    # Pre-chain for log records originating from external standard library loggers
    foreign_pre_chain = [
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    # Processors applied when logging directly via structlog
    structlog_processors = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
        structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
    ]

    structlog.configure(
        processors=structlog_processors,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    if use_json:
        formatter_processors = [
            structlog.processors.format_exc_info,
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.processors.JSONRenderer(),
        ]
    else:
        formatter_processors = [
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            structlog.dev.ConsoleRenderer(colors=True),
        ]

    formatter = structlog.stdlib.ProcessorFormatter(
        foreign_pre_chain=foreign_pre_chain,
        processors=formatter_processors,
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.handlers.clear()
    root_logger.addHandler(handler)
    root_logger.setLevel(log_level)

    # Prevent noise from low-level libraries unless debug is explicitly requested
    if log_level > logging.DEBUG:
        for quiet_logger in ("uvicorn.access", "httpcore", "httpx", "urllib3"):
            logging.getLogger(quiet_logger).setLevel(logging.WARNING)

    logger = structlog.get_logger("doctor_platform")
    logger.info(
        "logging_initialized",
        environment=settings.ENVIRONMENT,
        log_level=log_level_name,
        log_format="json" if use_json else "console",
    )
    return logger


def get_logger(name: Optional[str] = None) -> structlog.stdlib.BoundLogger:
    """Returns a bound structlog logger."""
    return structlog.get_logger(name or "doctor_platform")

