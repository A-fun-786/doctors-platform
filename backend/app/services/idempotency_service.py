import hashlib
import hmac
import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.idempotency import IdempotencyRecord

MAX_IDEMPOTENCY_KEY_LENGTH = 255


def _utc_now(now: Optional[datetime] = None) -> datetime:
    if now is None:
        return datetime.now(timezone.utc)
    if now.tzinfo is None:
        return now.replace(tzinfo=timezone.utc)
    return now


def _is_expired(expires_at: datetime, now: datetime) -> bool:
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    return expires_at <= now


def normalize_idempotency_key(raw_key: Optional[str]) -> Optional[str]:
    """Validate and normalize an incoming Idempotency-Key header value."""
    if raw_key is None:
        return None
    normalized = raw_key.strip()
    if not normalized:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Idempotency-Key header cannot be blank",
        )
    if len(normalized) > MAX_IDEMPOTENCY_KEY_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Idempotency-Key header must not exceed {MAX_IDEMPOTENCY_KEY_LENGTH} characters",
        )
    return normalized


def compute_request_hash(payload: BaseModel) -> str:
    """Compute a deterministic SHA-256 fingerprint of a Pydantic request payload."""
    canonical = json.dumps(
        payload.model_dump(mode="json"),
        sort_keys=True,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def lookup_idempotency_record(
    db: Session,
    doctor_id: uuid.UUID,
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
    now: Optional[datetime] = None,
) -> Optional[IdempotencyRecord]:
    """
    Look up an active persisted idempotency record.
    - Deletes expired records safely using a bulk DELETE (race-safe).
    - Raises 422 Unprocessable Entity if the key is reused with a different payload.
    """
    current_time = _utc_now(now)
    record = (
        db.query(IdempotencyRecord)
        .filter(
            IdempotencyRecord.doctor_id == doctor_id,
            IdempotencyRecord.endpoint == endpoint,
            IdempotencyRecord.idempotency_key == idempotency_key,
        )
        .first()
    )
    if record is None:
        return None

    if _is_expired(record.expires_at, current_time):
        (
            db.query(IdempotencyRecord)
            .filter(IdempotencyRecord.id == record.id)
            .delete(synchronize_session=False)
        )
        db.flush()
        return None

    if not hmac.compare_digest(record.request_hash, request_hash):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Idempotency-Key was already used with a different request payload",
        )

    return record


def build_idempotency_record(
    doctor_id: uuid.UUID,
    endpoint: str,
    idempotency_key: str,
    request_hash: str,
    status_code: int = status.HTTP_201_CREATED,
    ttl_seconds: Optional[int] = None,
    now: Optional[datetime] = None,
) -> IdempotencyRecord:
    """Instantiate a new IdempotencyRecord ready to flush inside a transaction."""
    ttl = ttl_seconds if ttl_seconds is not None else get_settings().IDEMPOTENCY_TTL_SECONDS
    current_time = _utc_now(now)
    return IdempotencyRecord(
        doctor_id=doctor_id,
        endpoint=endpoint,
        idempotency_key=idempotency_key,
        request_hash=request_hash,
        status_code=status_code,
        response_body={},
        appointment_id=None,
        expires_at=current_time + timedelta(seconds=ttl),
    )
