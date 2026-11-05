import uuid
from datetime import date, datetime
from typing import Optional
from sqlalchemy import (
    String,
    Text,
    Date,
    DateTime,
    Integer,
    Boolean,
    ForeignKey,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class StaffMember(Base, TimestampMixin):
    """
    Staff member record under a clinic/doctor.
    Supports Doctors, Junior Doctors, Nurses, Receptionists, and clinic personnel.
    Multi-tenant isolation strictly enforced by doctor_id.
    """
    __tablename__ = "staff_members"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[str] = mapped_column(String(30), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)  # Doctor, Junior Doctor, Nurse, Receptionist, Pharmacist, Lab Technician, Billing Executive, etc.
    department: Mapped[str] = mapped_column(String(50), nullable=False, default="Clinical")  # Clinical, Nursing, Front Desk, Pharmacy, Laboratory, Administration, Emergency, General
    employment_type: Mapped[str] = mapped_column(String(30), nullable=False, default="full_time")  # full_time, part_time, contract, shift
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="active")  # active, on_leave, inactive, terminated
    joining_date: Mapped[date] = mapped_column(Date, nullable=False, default=date.today)
    
    # Financial compensation stored strictly in integer paise (₹1 = 100 paise)
    base_salary_paise: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    emergency_contact: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Authentication & Portal Access fields
    can_login: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    must_change_password: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # Doctor relationship
    doctor: Mapped["Doctor"] = relationship("Doctor")

    __table_args__ = (
        Index("idx_staff_doctor_status", "doctor_id", "status"),
        Index("idx_staff_doctor_dept", "doctor_id", "department"),
        Index("idx_staff_email", "email"),
    )
