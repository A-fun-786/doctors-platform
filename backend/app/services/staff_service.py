import re
import uuid
from datetime import date
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.doctor import Doctor
from app.models.staff import StaffMember, is_doctor_role
from app.models.appointment import Appointment
from app.schemas.staff import (
    StaffMemberCreate,
    StaffMemberUpdate,
    StaffSummaryMetricsResponse,
)

HONORIFICS = {
    "dr", "dr.", "doctor", "mr", "mr.", "mrs", "mrs.", "ms", "ms.",
    "prof", "prof.", "nurse", "sister", "brother"
}
USERNAME_REGEX = re.compile(r"^[a-zA-Z0-9._-]+$")


def generate_username_candidates(full_name: str) -> List[str]:
    """
    Generate candidate staff User IDs derived from the staff member's full name.
    Follows name-derived alphanumeric patterns (e.g., Emanur Rahman ->
    emanur.rahman, e.rahman, emanur.r, emanurrahman, erahman, emanurr,
    then minimal numbers like e1.rahman, emanur.r1, e2.rahman, emanur.r2).
    """
    raw_tokens = re.findall(r"[a-zA-Z0-9]+", full_name.lower())
    tokens = [t for t in raw_tokens if t not in HONORIFICS]
    if not tokens:
        tokens = raw_tokens or ["staff"]

    candidates: List[str] = []

    if len(tokens) == 1:
        base = tokens[0]
        candidates.append(base)
        for i in range(1, 100):
            candidates.append(f"{base}{i}")
        return candidates

    first = tokens[0]
    last = tokens[-1]
    f_init = first[0]
    l_init = last[0]

    # Priority 1: Pure name patterns without numbers
    candidates.append(f"{first}.{last}")
    candidates.append(f"{f_init}.{last}")
    candidates.append(f"{first}.{l_init}")
    candidates.append(f"{first}{last}")
    candidates.append(f"{f_init}{last}")
    candidates.append(f"{first}{l_init}")

    # For 3 or more tokens (e.g. Mohammad Emanur Rahman)
    if len(tokens) >= 3:
        candidates.append(f"{tokens[0]}.{tokens[1]}.{tokens[2]}")
        candidates.append(f"{tokens[0][0]}.{tokens[1][0]}.{tokens[2]}")

    # Priority 2: Minimal numeric patterns matching user specification:
    # e1.rahman, emanur.r1, e2.rahman, emanur.r2...
    for i in range(1, 100):
        candidates.append(f"{f_init}{i}.{last}")
        candidates.append(f"{first}.{l_init}{i}")
        candidates.append(f"{first}.{last}{i}")
        candidates.append(f"{first}{i}.{last}")
        candidates.append(f"{f_init}{last}{i}")

    # Deduplicate preserving priority order
    seen = set()
    ordered = []
    for c in candidates:
        if c not in seen:
            seen.add(c)
            ordered.append(c)
    return ordered


def generate_unique_staff_username(db: Session, full_name: str) -> str:
    """
    Generate the next available unique User ID for a staff member.
    Queries database in batches of candidate names to minimize DB roundtrips (O(1) roundtrip for typical case).
    """
    candidates = generate_username_candidates(full_name)
    chunk_size = 50
    for i in range(0, len(candidates), chunk_size):
        chunk = candidates[i : i + chunk_size]
        chunk_lowers = [c.lower() for c in chunk]
        existing = set(
            db.scalars(
                select(func.lower(StaffMember.username)).where(
                    func.lower(StaffMember.username).in_(chunk_lowers)
                )
            ).all()
        )
        for candidate in chunk:
            if candidate.lower() not in existing:
                return candidate

    return f"staff.{uuid.uuid4().hex[:6]}"


class StaffService:
    def __init__(self, db: Session):
        self.db = db

    def list_staff(
        self,
        doctor_id: uuid.UUID,
        department: Optional[str] = None,
        role: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[StaffMember]:
        query = select(StaffMember).where(StaffMember.doctor_id == doctor_id)

        if department:
            query = query.where(StaffMember.department.ilike(f"%{department}%"))
        if role:
            query = query.where(StaffMember.role.ilike(f"%{role}%"))
        if status:
            query = query.where(StaffMember.status == status)
        if search:
            search_term = f"%{search.strip()}%"
            query = query.where(
                or_(
                    StaffMember.full_name.ilike(search_term),
                    StaffMember.username.ilike(search_term),
                    StaffMember.email.ilike(search_term),
                    StaffMember.phone.ilike(search_term),
                    StaffMember.role.ilike(search_term),
                )
            )

        query = query.order_by(StaffMember.full_name.asc())
        return list(self.db.scalars(query).all())

    def get_staff_by_id(
        self, doctor_id: uuid.UUID, staff_id: uuid.UUID
    ) -> Optional[StaffMember]:
        return self.db.scalar(
            select(StaffMember).where(
                and_(
                    StaffMember.id == staff_id,
                    StaffMember.doctor_id == doctor_id,
                )
            )
        )

    def create_staff(
        self, doctor_id: uuid.UUID, data: StaffMemberCreate
    ) -> StaffMember:
        email = data.email.strip().lower() if data.email else None

        # User ID assignment & uniqueness validation
        if data.username and data.username.strip():
            username = data.username.strip().lstrip("@").lower()
            if not (3 <= len(username) <= 60 and USERNAME_REGEX.match(username)):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="User ID must be between 3 and 60 alphanumeric characters (dots, underscores, and hyphens allowed)",
                )
            existing_user = self.db.scalar(
                select(StaffMember).where(func.lower(StaffMember.username) == username)
            )
            if existing_user:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A staff member with this User ID already exists",
                )
        else:
            username = generate_unique_staff_username(self.db, data.full_name)

        # Portal login access validation
        hashed_pw = None
        if data.can_login:
            if not data.password or len(data.password) < 6:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password must be at least 6 characters long",
                )
            if email:
                existing_staff = self.db.scalar(
                    select(StaffMember).where(
                        and_(
                            func.lower(StaffMember.email) == email,
                            StaffMember.can_login.is_(True),
                        )
                    )
                )
                if existing_staff:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="A staff member with this login email already exists",
                    )

            hashed_pw = hash_password(data.password)

        staff = StaffMember(
            doctor_id=doctor_id,
            full_name=data.full_name.strip(),
            username=username,
            email=email,
            phone=data.phone.strip(),
            role=data.role.strip(),
            speciality=data.speciality.strip() if data.speciality else None,
            department=data.department.strip() if data.department else "Clinical",
            employment_type=data.employment_type,
            status=data.status,
            joining_date=data.joining_date or date.today(),
            base_salary_paise=data.base_salary_paise,
            emergency_contact=data.emergency_contact.strip() if data.emergency_contact else None,
            notes=data.notes.strip() if data.notes else None,
            can_login=data.can_login,
            hashed_password=hashed_pw,
            must_change_password=True if data.can_login else False,
            token_version=1,
        )
        self.db.add(staff)
        try:
            self.db.commit()
            self.db.refresh(staff)
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A database conflict occurred while creating the staff record (duplicate User ID or email).",
            )
        return staff

    def update_staff(
        self, doctor_id: uuid.UUID, staff_id: uuid.UUID, data: StaffMemberUpdate
    ) -> Optional[StaffMember]:
        staff = self.get_staff_by_id(doctor_id, staff_id)
        if not staff:
            return None

        update_dict = data.model_dump(exclude_unset=True)

        # Handle username update
        if "username" in update_dict:
            new_username = update_dict.pop("username")
            if new_username:
                new_username = new_username.strip().lstrip("@").lower()
                if not (3 <= len(new_username) <= 60 and USERNAME_REGEX.match(new_username)):
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="User ID must be between 3 and 60 alphanumeric characters (dots, underscores, and hyphens allowed)",
                    )
                existing = self.db.scalar(
                    select(StaffMember).where(
                        and_(
                            func.lower(StaffMember.username) == new_username,
                            StaffMember.id != staff.id,
                        )
                    )
                )
                if existing:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="A staff member with this User ID already exists",
                    )
                staff.username = new_username

        # Handle password update
        if "password" in update_dict:
            pwd = update_dict.pop("password")
            if pwd:
                if len(pwd) < 6:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Password must be at least 6 characters long",
                    )
                staff.hashed_password = hash_password(pwd)
                staff.must_change_password = True
                staff.token_version = (staff.token_version or 1) + 1

        # Handle can_login toggle
        if "can_login" in update_dict and update_dict["can_login"] is True:
            if not staff.username:
                staff.username = generate_unique_staff_username(self.db, staff.full_name)
            if not staff.hashed_password and "password" not in data.model_dump(exclude_unset=True):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A password must be set when granting portal login access",
                )

        # Enforce email uniqueness across portal login-enabled accounts
        target_can_login = update_dict.get("can_login", staff.can_login)
        target_email = update_dict.get("email", staff.email)
        if target_can_login and target_email:
            norm_email = target_email.strip().lower()
            existing_email_staff = self.db.scalar(
                select(StaffMember).where(
                    and_(
                        func.lower(StaffMember.email) == norm_email,
                        StaffMember.id != staff.id,
                        StaffMember.can_login.is_(True),
                    )
                )
            )
            if existing_email_staff:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A staff member with this login email already exists",
                )

        for field, value in update_dict.items():
            if field == "email":
                norm_email = value.strip().lower() if (value and isinstance(value, str) and value.strip()) else None
                setattr(staff, "email", norm_email)
            elif value is not None and isinstance(value, str):
                setattr(staff, field, value.strip())
            else:
                setattr(staff, field, value)

        # If role is updated to a non-doctor role, ensure speciality is cleared
        if "role" in update_dict and not staff.is_doctor:
            if "speciality" not in update_dict:
                staff.speciality = None

        try:
            self.db.commit()
            self.db.refresh(staff)
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A database conflict occurred while updating the staff record.",
            )
        return staff

    def reset_staff_password(
        self, doctor_id: uuid.UUID, staff_id: uuid.UUID, new_password: str
    ) -> StaffMember:
        staff = self.get_staff_by_id(doctor_id, staff_id)
        if not staff:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Staff member not found",
            )
        if not staff.can_login:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Portal login is not enabled for this staff member",
            )
        if not new_password or len(new_password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters long",
            )

        staff.hashed_password = hash_password(new_password)
        staff.must_change_password = True
        staff.token_version = (staff.token_version or 1) + 1
        self.db.commit()
        self.db.refresh(staff)
        return staff

    def delete_staff(
        self, doctor_id: uuid.UUID, staff_id: uuid.UUID
    ) -> bool:
        staff = self.get_staff_by_id(doctor_id, staff_id)
        if not staff:
            return False

        # Guard against silent reassignment and DB slot collision:
        # Check for active (BOOKED) appointments linked to this staff member
        active_appts = self.db.scalar(
            select(func.count(Appointment.id)).where(
                Appointment.doctor_id == doctor_id,
                Appointment.staff_id == staff_id,
                Appointment.status == "BOOKED",
            )
        ) or 0
        if active_appts > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot delete staff member with {active_appts} active appointment(s). "
                    "Please reassign, reschedule, or cancel their appointments before deleting."
                ),
            )

        # Check for completed historical clinical appointments
        completed_appts = self.db.scalar(
            select(func.count(Appointment.id)).where(
                Appointment.doctor_id == doctor_id,
                Appointment.staff_id == staff_id,
                Appointment.status == "COMPLETED",
            )
        ) or 0
        if completed_appts > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cannot delete staff member with {completed_appts} completed consultation record(s). "
                    "Please set their status to 'inactive' to preserve clinical audit trails."
                ),
            )

        self.db.delete(staff)
        self.db.commit()
        return True

    def get_summary_metrics(self, doctor_id: uuid.UUID) -> StaffSummaryMetricsResponse:
        total_staff = self.db.scalar(
            select(func.count(StaffMember.id)).where(StaffMember.doctor_id == doctor_id)
        ) or 0

        active_staff = self.db.scalar(
            select(func.count(StaffMember.id)).where(
                and_(
                    StaffMember.doctor_id == doctor_id,
                    StaffMember.status == "active",
                )
            )
        ) or 0

        roles = self.db.scalars(
            select(StaffMember.role).where(StaffMember.doctor_id == doctor_id)
        ).all()
        doctors_count = sum(1 for r in roles if is_doctor_role(r))

        departments_count = self.db.scalar(
            select(func.count(func.distinct(StaffMember.department))).where(
                StaffMember.doctor_id == doctor_id
            )
        ) or 0

        return StaffSummaryMetricsResponse(
            total_staff=total_staff,
            active_staff=active_staff,
            doctors_count=doctors_count,
            departments_count=departments_count,
        )
