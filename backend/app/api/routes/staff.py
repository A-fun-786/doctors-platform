import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor, get_db
from app.models.doctor import Doctor
from app.schemas.staff import (
    StaffMemberCreate,
    StaffMemberUpdate,
    StaffMemberResponse,
    StaffSummaryMetricsResponse,
)
from app.services.staff_service import StaffService

router = APIRouter(prefix="/staff", tags=["Staff Management"])


@router.get(
    "/summary",
    response_model=StaffSummaryMetricsResponse,
    summary="Get Staff Management KPI summary metrics",
)
def get_staff_summary(
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    service = StaffService(db)
    return service.get_summary_metrics(current_doctor.id)


@router.get(
    "",
    response_model=List[StaffMemberResponse],
    summary="List all staff members with optional filtering",
)
def list_staff(
    department: Optional[str] = Query(None, description="Filter by department"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status: Optional[str] = Query(None, description="Filter by status (active, on_leave, inactive)"),
    search: Optional[str] = Query(None, description="Search by name, email, phone, or role"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    service = StaffService(db)
    return service.list_staff(
        doctor_id=current_doctor.id,
        department=department,
        role=role,
        status=status,
        search=search,
    )


@router.post(
    "",
    response_model=StaffMemberResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new staff member or doctor to the clinic",
)
def create_staff(
    payload: StaffMemberCreate,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    service = StaffService(db)
    return service.create_staff(current_doctor.id, payload)


@router.get(
    "/{staff_id}",
    response_model=StaffMemberResponse,
    summary="Get single staff member details",
)
def get_staff_member(
    staff_id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    service = StaffService(db)
    staff = service.get_staff_by_id(current_doctor.id, staff_id)
    if not staff:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    return staff


@router.put(
    "/{staff_id}",
    response_model=StaffMemberResponse,
    summary="Update staff member profile",
)
def update_staff_member(
    staff_id: uuid.UUID,
    payload: StaffMemberUpdate,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    service = StaffService(db)
    updated = service.update_staff(current_doctor.id, staff_id, payload)
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    return updated


@router.delete(
    "/{staff_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete staff member",
)
def delete_staff_member(
    staff_id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    service = StaffService(db)
    deleted = service.delete_staff(current_doctor.id, staff_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Staff member not found")
    return None
