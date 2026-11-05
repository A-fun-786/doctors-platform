import uuid
from datetime import date
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.doctor import Doctor
from app.models.staff import StaffMember
from app.schemas.staff import (
    StaffMemberCreate,
    StaffMemberUpdate,
    StaffSummaryMetricsResponse,
)


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
        
        # Portal login access validation
        hashed_pw = None
        if data.can_login:
            if not email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A valid email is required to grant portal login access",
                )
            if not data.password or len(data.password) < 6:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Password must be at least 6 characters long",
                )
            # Check for email collision in staff or doctor
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

            existing_doc = self.db.scalar(
                select(Doctor).where(func.lower(Doctor.email) == email)
            )
            if existing_doc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This email is already registered as a doctor account",
                )

            hashed_pw = hash_password(data.password)

        staff = StaffMember(
            doctor_id=doctor_id,
            full_name=data.full_name.strip(),
            email=email,
            phone=data.phone.strip(),
            role=data.role.strip(),
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
        )
        self.db.add(staff)
        self.db.commit()
        self.db.refresh(staff)
        return staff

    def update_staff(
        self, doctor_id: uuid.UUID, staff_id: uuid.UUID, data: StaffMemberUpdate
    ) -> Optional[StaffMember]:
        staff = self.get_staff_by_id(doctor_id, staff_id)
        if not staff:
            return None

        update_dict = data.model_dump(exclude_unset=True)

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

        # Handle can_login toggle
        if "can_login" in update_dict and update_dict["can_login"] is True:
            target_email = update_dict.get("email", staff.email)
            if not target_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A valid email is required to grant portal login access",
                )
            if not staff.hashed_password and "password" not in data.model_dump(exclude_unset=True):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="A password must be set when granting portal login access",
                )

        for field, value in update_dict.items():
            if value is not None and isinstance(value, str):
                setattr(staff, field, value.strip())
            else:
                setattr(staff, field, value)

        self.db.commit()
        self.db.refresh(staff)
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
        self.db.commit()
        self.db.refresh(staff)
        return staff

    def delete_staff(
        self, doctor_id: uuid.UUID, staff_id: uuid.UUID
    ) -> bool:
        staff = self.get_staff_by_id(doctor_id, staff_id)
        if not staff:
            return False

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

        doctors_count = self.db.scalar(
            select(func.count(StaffMember.id)).where(
                and_(
                    StaffMember.doctor_id == doctor_id,
                    StaffMember.role.ilike("%doctor%"),
                )
            )
        ) or 0

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
