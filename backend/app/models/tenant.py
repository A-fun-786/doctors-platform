import uuid
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Boolean, ForeignKey, String, Uuid
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
    clinic_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    location: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True,
    )

    # Platform Services offered by Doctor
    service_appointment: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    service_video_consultation: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
    )
    service_medicine_inventory: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )
    service_lab_reports: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False,
    )

    # 1:1 Relationship with Doctor
    doctor: Mapped["Doctor"] = relationship(
        "Doctor",
        back_populates="tenant",
    )
