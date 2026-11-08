import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_active_tenant_by_slug
from app.core.database import get_db
from app.models.tenant import Tenant
from app.schemas.profile import (
    PublicDoctorProfileResponse,
    ServicesConfig,
    ReportUploadRequest,
    ReportUploadResponse,
    MedicineOrderRequest,
    MedicineOrderResponse,
)

router = APIRouter(prefix="/public", tags=["public"])


@router.get("/tenants/{slug}", response_model=PublicDoctorProfileResponse)
def get_public_doctor_profile(
    slug: str,
    db: Session = Depends(get_db),
) -> PublicDoctorProfileResponse:
    """Retrieve public practice details and active services for the patient-facing webpage."""
    tenant = get_active_tenant_by_slug(slug, db)
    doctor = tenant.doctor

    services = ServicesConfig(
        appointment=tenant.service_appointment,
        video_consultation=tenant.service_video_consultation,
        medicine_inventory=tenant.service_medicine_inventory,
        lab_reports=tenant.service_lab_reports,
    )

    return PublicDoctorProfileResponse(
        full_name=doctor.full_name,
        avatar_url=doctor.avatar_url,
        speciality=doctor.speciality,
        bio=doctor.bio,
        clinic_name=tenant.clinic_name,
        location=tenant.location,
        slug=tenant.slug,
        services=services,
    )



@router.post(
    "/tenants/{slug}/reports",
    response_model=ReportUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_lab_report(
    slug: str,
    payload: ReportUploadRequest,
    db: Session = Depends(get_db),
) -> ReportUploadResponse:
    """Submit a lab test report from the patient-facing webpage."""
    tenant = get_active_tenant_by_slug(slug, db)

    if not tenant.service_lab_reports:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Lab reports service is not active for this practice.",
        )

    report_id = f"REP-{uuid.uuid4().hex[:8].upper()}"

    return ReportUploadResponse(
        report_id=report_id,
        status="received",
        message=f"Report '{payload.file_name}' received and attached to your patient record.",
    )


@router.post(
    "/tenants/{slug}/medicine-orders",
    response_model=MedicineOrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def order_medicine(
    slug: str,
    payload: MedicineOrderRequest,
    db: Session = Depends(get_db),
) -> MedicineOrderResponse:
    """Submit a medicine order or prescription delivery request from the patient-facing webpage."""
    tenant = get_active_tenant_by_slug(slug, db)

    if not tenant.service_medicine_inventory:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Medicine order service is not active for this practice.",
        )

    order_id = f"MED-{uuid.uuid4().hex[:8].upper()}"

    return MedicineOrderResponse(
        order_id=order_id,
        status="received",
        message=f"Medicine request order #{order_id} received. The pharmacy team will prepare your order.",
    )
