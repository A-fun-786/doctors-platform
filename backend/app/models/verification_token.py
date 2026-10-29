import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import DateTime, ForeignKey, Index, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.doctor import Doctor


class EmailVerificationToken(Base, TimestampMixin):
    """Token entity representing an email verification or password reset token."""

    __tablename__ = "email_verification_tokens"

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
    token_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    purpose: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )
    used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    __table_args__ = (
        Index("ix_email_verification_tokens_doctor_purpose", "doctor_id", "purpose"),
        Index("ix_email_verification_tokens_token_hash", "token_hash"),
    )

    doctor: Mapped["Doctor"] = relationship(
        "Doctor",
        back_populates="email_verification_tokens",
    )
