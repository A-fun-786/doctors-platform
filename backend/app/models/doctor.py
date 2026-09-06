import uuid
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.tenant import Tenant


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

    # 1:1 Relationship with Tenant
    tenant: Mapped[Optional["Tenant"]] = relationship(
        "Tenant",
        back_populates="doctor",
        uselist=False,
        cascade="all, delete-orphan",
    )
