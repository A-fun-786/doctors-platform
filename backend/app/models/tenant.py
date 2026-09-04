import uuid
from typing import TYPE_CHECKING
from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.doctor import Doctor


class Tenant(Base, TimestampMixin):
    """Tenant entity representing an isolated workspace owned by a Doctor."""

    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    slug: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="active",
        nullable=False,
    )

    # 1:1 Relationship with Doctor
    doctor: Mapped["Doctor"] = relationship(
        "Doctor",
        back_populates="tenant",
    )
