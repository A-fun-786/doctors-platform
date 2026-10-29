import uuid
from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import Boolean, DateTime, Integer, JSON, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.tenant import Tenant
    from app.models.schedule import Schedule
    from app.models.appointment import Appointment
    from app.models.verification_token import EmailVerificationToken


class Doctor(Base, TimestampMixin):
    """Doctor entity representing a platform user who manages a tenant."""

    __tablename__ = "doctors"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    phone: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    app_icon_url: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    speciality: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    bio: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    onboarding_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    auth_provider: Mapped[str] = mapped_column(
        String(50),
        default="google",
        nullable=False,
    )
    provider_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    hashed_password: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    working_hours: Mapped[Optional[dict]] = mapped_column(
        JSON,
        nullable=True,
    )
    email_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    email_verified_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )
    failed_login_attempts: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # 1:1 Relationship with Tenant
    tenant: Mapped[Optional["Tenant"]] = relationship(
        "Tenant",
        back_populates="doctor",
        uselist=False,
        cascade="all, delete-orphan",
    )

    # 1:Many Relationships with Schedule and Appointment
    schedules: Mapped[List["Schedule"]] = relationship(
        "Schedule",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )

    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )

    email_verification_tokens: Mapped[List["EmailVerificationToken"]] = relationship(
        "EmailVerificationToken",
        back_populates="doctor",
        cascade="all, delete-orphan",
    )
