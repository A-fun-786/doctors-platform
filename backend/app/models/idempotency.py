import uuid
import datetime
from typing import Any, Dict, Optional
from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import Base, TimestampMixin


class IdempotencyRecord(Base, TimestampMixin):
    """Persisted idempotency record binding a key and endpoint to a request fingerprint and response."""

    __tablename__ = "idempotency_records"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
    )
    endpoint: Mapped[str] = mapped_column(
        String(128),
        nullable=False,
    )
    idempotency_key: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    request_hash: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
    )
    status_code: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    response_body: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
    )
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("appointments.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime.datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint(
            "doctor_id",
            "endpoint",
            "idempotency_key",
            name="uq_idempotency_doctor_endpoint_key",
        ),
        Index("ix_idempotency_records_expires_at", "expires_at"),
    )
