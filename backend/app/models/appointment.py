import uuid
import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Date, ForeignKey, Index, Integer, String, Text, Time, Uuid, text, event
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


@event.listens_for(Appointment.__table__, "after_create")
def _create_appointment_overlap_triggers(target, connection, **kw):
    """Enforce overlap exclusion at the database level."""
    if connection.dialect.name == "sqlite":
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS trg_appointment_no_overlap_insert
            BEFORE INSERT ON appointments
            FOR EACH ROW
            WHEN NEW.status != 'CANCELLED'
            BEGIN
                SELECT RAISE(ABORT, 'Slot overlap detected: practitioner already booked')
                WHERE EXISTS (
                    SELECT 1 FROM appointments
                    WHERE doctor_id = NEW.doctor_id
                      AND date = NEW.date
                      AND status != 'CANCELLED'
                      AND start_time < NEW.end_time
                      AND end_time > NEW.start_time
                      AND (
                          (NEW.staff_id IS NULL AND staff_id IS NULL)
                          OR (NEW.staff_id IS NOT NULL AND staff_id = NEW.staff_id)
                      )
                );
            END;
        """))
        connection.execute(text("""
            CREATE TRIGGER IF NOT EXISTS trg_appointment_no_overlap_update
            BEFORE UPDATE ON appointments
            FOR EACH ROW
            WHEN NEW.status != 'CANCELLED'
            BEGIN
                SELECT RAISE(ABORT, 'Slot overlap detected: practitioner already booked')
                WHERE EXISTS (
                    SELECT 1 FROM appointments
                    WHERE id != NEW.id
                      AND doctor_id = NEW.doctor_id
                      AND date = NEW.date
                      AND status != 'CANCELLED'
                      AND start_time < NEW.end_time
                      AND end_time > NEW.start_time
                      AND (
                          (NEW.staff_id IS NULL AND staff_id IS NULL)
                          OR (NEW.staff_id IS NOT NULL AND staff_id = NEW.staff_id)
                      )
                );
            END;
        """))
    elif connection.dialect.name == "postgresql":
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS btree_gist;"))
        connection.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_primary_doctor_no_overlap'
                ) THEN
                    ALTER TABLE appointments ADD CONSTRAINT uq_primary_doctor_no_overlap
                    EXCLUDE USING gist (
                        doctor_id WITH =,
                        (tsrange(date + start_time, date + end_time, '[)')) WITH &&
                    ) WHERE (status != 'CANCELLED' AND staff_id IS NULL);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_staff_doctor_no_overlap'
                ) THEN
                    ALTER TABLE appointments ADD CONSTRAINT uq_staff_doctor_no_overlap
                    EXCLUDE USING gist (
                        doctor_id WITH =,
                        staff_id WITH =,
                        (tsrange(date + start_time, date + end_time, '[)')) WITH &&
                    ) WHERE (status != 'CANCELLED' AND staff_id IS NOT NULL);
                END IF;
            END $$;
        """))
