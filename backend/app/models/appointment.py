import uuid
import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text, Time, Uuid, text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.doctor import Doctor
    from app.models.staff import StaffMember


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
    staff_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("staff_members.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
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
    patient_gender: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    patient_age: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True,
    )
    patient_height: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    patient_weight: Mapped[Optional[str]] = mapped_column(
        String(20),
        nullable=True,
    )
    patient_blood_group: Mapped[Optional[str]] = mapped_column(
        String(10),
        nullable=True,
    )
    patient_address: Mapped[Optional[str]] = mapped_column(
        Text,
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
            "uq_primary_doctor_active_slot",
            "doctor_id",
            "date",
            "start_time",
            unique=True,
            postgresql_where=text("status != 'CANCELLED' AND staff_id IS NULL"),
            sqlite_where=text("status != 'CANCELLED' AND staff_id IS NULL"),
        ),
        Index(
            "uq_staff_doctor_active_slot",
            "doctor_id",
            "staff_id",
            "date",
            "start_time",
            unique=True,
            postgresql_where=text("status != 'CANCELLED' AND staff_id IS NOT NULL"),
            sqlite_where=text("status != 'CANCELLED' AND staff_id IS NOT NULL"),
        ),
        Index("ix_appointments_doctor_date", "doctor_id", "date"),
        Index("ix_appointments_doctor_status", "doctor_id", "status"),
        Index("ix_appointments_doctor_staff", "doctor_id", "staff_id"),
    )

    doctor: Mapped["Doctor"] = relationship(
        "Doctor",
        back_populates="appointments",
    )
    staff_member: Mapped[Optional["StaffMember"]] = relationship(
        "StaffMember",
        foreign_keys=[staff_id],
        lazy="joined",
    )

    @property
    def staff_name(self) -> Optional[str]:
        return self.staff_member.full_name if self.staff_member else None

    @property
    def doctor_name(self) -> Optional[str]:
        if self.staff_member:
            return self.staff_member.full_name
        if self.doctor:
            return self.doctor.full_name
        return None
