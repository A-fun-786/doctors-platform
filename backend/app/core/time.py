from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def get_clinic_now(now: Optional[datetime] = None) -> datetime:
    """Return the current clinic wall-clock time (naive) in CLINIC_TIMEZONE.

    When an explicit ``now`` is supplied:
    - tz-aware datetimes are converted to CLINIC_TIMEZONE before stripping tzinfo.
    - naive datetimes are treated as already being in CLINIC_TIMEZONE.
    """
    tz = ZoneInfo(get_settings().CLINIC_TIMEZONE)
    if now is not None:
        if now.tzinfo is not None:
            return now.astimezone(tz).replace(tzinfo=None)
        return now
    return datetime.now(tz).replace(tzinfo=None)
