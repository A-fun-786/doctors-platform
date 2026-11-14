import uuid
import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Date, ForeignKey, Index, String, Text, Time, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.doctor import Doctor


class Schedule(Base, TimestampMixin):
    """Calendar event defining doctor working hours or unavailability windows."""

    __tablename__ = "schedules"

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
    type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )  # AVAILABLE, LEAVE, HOLIDAY, BLOCKED
    reason: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    __table_args__ = (
        Index("ix_schedules_doctor_date", "doctor_id", "date"),
    )

    doctor: Mapped["Doctor"] = relationship(
        "Doctor",
        back_populates="schedules",
    )
