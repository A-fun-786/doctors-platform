import uuid
from datetime import date
from typing import List, Optional
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import Session

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
        staff = StaffMember(
            doctor_id=doctor_id,
            full_name=data.full_name.strip(),
            email=data.email.strip() if data.email else None,
            phone=data.phone.strip(),
            role=data.role.strip(),
            department=data.department.strip() if data.department else "Clinical",
            employment_type=data.employment_type,
            status=data.status,
            joining_date=data.joining_date or date.today(),
            base_salary_paise=data.base_salary_paise,
            emergency_contact=data.emergency_contact.strip() if data.emergency_contact else None,
            notes=data.notes.strip() if data.notes else None,
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
        for field, value in update_dict.items():
            if value is not None and isinstance(value, str):
                setattr(staff, field, value.strip())
            else:
                setattr(staff, field, value)

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
