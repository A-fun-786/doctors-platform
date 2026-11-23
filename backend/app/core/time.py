from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def get_clinic_timezone() -> ZoneInfo:
    """Return the configured clinic IANA timezone."""
    return ZoneInfo(get_settings().CLINIC_TIMEZONE)


def get_clinic_now(now: Optional[datetime] = None) -> datetime:
    """
    Return the current wall-clock datetime in the configured clinic timezone.

    If an explicit ``now`` override is supplied:
    - timezone-aware datetimes are converted into the clinic timezone;
    - naive datetimes are treated as already expressed in clinic local time.
    """
    clinic_tz = get_clinic_timezone()
    if now is None:
        return datetime.now(clinic_tz)
    if now.tzinfo is not None:
        return now.astimezone(clinic_tz)
    return now
