import uuid
import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Date, ForeignKey, Index, String, Text, Time, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.doctor import Doctor


class Appointment(Base, TimestampMixin):
    """Appointment entity representing a booked doctor slot."""

    __tablename__ = "appointments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    patient_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        nullable=True,
    )
    request_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        nullable=True,
    )
    patient_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    patient_contact: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    date: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
    )
    start_time: Mapped[datetime.time] = mapped_column(
        Time,
        nullable=False,
    )
    end_time: Mapped[datetime.time] = mapped_column(
        Time,
        nullable=False,
    )
    reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        default="BOOKED",
        nullable=False,
    )

    __table_args__ = (
        Index(
            "uq_doctor_active_appointment_slot",
            "doctor_id",
            "date",
            "start_time",
            unique=True,
            postgresql_where=text("status != 'CANCELLED'"),
            sqlite_where=text("status != 'CANCELLED'"),
        ),
        Index("ix_appointments_doctor_date", "doctor_id", "date"),
        Index("ix_appointments_doctor_status", "doctor_id", "status"),
    )

    doctor: Mapped["Doctor"] = relationship(
        "Doctor",
        back_populates="appointments",
    )
