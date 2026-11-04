import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor
from app.core.database import get_db
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.schemas.billing import (
    ServiceCatalogItemCreateRequest,
    ServiceCatalogItemUpdateRequest,
    ServiceCatalogItemResponse,
    InvoiceCreateRequest,
    InvoiceUpdateRequest,
    InvoiceItemInput,
    PaymentCreateRequest,
    RefundCreateRequest,
    InvoiceResponse,
    InvoiceListResponse,
    PaymentResponse,
    RefundResponse,
    BillingStatsResponse,
)
from app.services import billing_service

router = APIRouter(prefix="/doctor/billing", tags=["billing"])


def _get_doctor_tenant(doctor: Doctor, db: Session) -> Tenant:
    """Helper to ensure active clinic tenant exists for doctor."""
    tenant = doctor.tenant
    if not tenant:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Doctor does not have an active practice tenant.",
        )
    return tenant


@router.get("/stats", response_model=BillingStatsResponse, summary="Get Billing & Daily Collection Statistics")
def get_billing_stats(
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> BillingStatsResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    return billing_service.get_billing_stats(tenant_id=tenant.id, db=db)


@router.get("/invoices", response_model=InvoiceListResponse, summary="List Clinic Invoices")
def list_invoices(
    status: Optional[str] = Query(None, description="Filter by status (draft, issued, partially_paid, paid, cancelled, refunded)"),
    search: Optional[str] = Query(None, description="Search by invoice number, patient name, contact"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> InvoiceListResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    return billing_service.list_invoices(
        tenant_id=tenant.id,
        status_filter=status,
        search=search,
        db=db,
    )


@router.post("/invoices", response_model=InvoiceResponse, status_code=status.HTTP_201_CREATED, summary="Create Invoice")
def create_invoice(
    payload: InvoiceCreateRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    inv = billing_service.create_invoice(
        tenant_id=tenant.id,
        doctor_id=current_doctor.id,
        payload=payload,
        db=db,
    )
    return InvoiceResponse.model_validate(inv)


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse, summary="Get Invoice Details")
def get_invoice(
    invoice_id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    inv = billing_service.get_invoice(tenant_id=tenant.id, invoice_id=invoice_id, db=db)
    return InvoiceResponse.model_validate(inv)


@router.put("/invoices/{invoice_id}", response_model=InvoiceResponse, summary="Update Draft Invoice")
def update_invoice(
    invoice_id: uuid.UUID,
    payload: InvoiceUpdateRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    inv = billing_service.update_invoice(
        tenant_id=tenant.id,
        doctor_id=current_doctor.id,
        invoice_id=invoice_id,
        payload=payload,
        db=db,
    )
    return InvoiceResponse.model_validate(inv)


@router.post("/invoices/{invoice_id}/issue", response_model=InvoiceResponse, summary="Lock & Issue Draft Invoice")
def issue_invoice(
    invoice_id: uuid.UUID,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    inv = billing_service.issue_invoice(
        tenant_id=tenant.id,
        doctor_id=current_doctor.id,
        invoice_id=invoice_id,
        db=db,
    )
    return InvoiceResponse.model_validate(inv)


@router.post("/invoices/{invoice_id}/cancel", response_model=InvoiceResponse, summary="Cancel Invoice")
def cancel_invoice(
    invoice_id: uuid.UUID,
    reason: str = Query(..., description="Reason for cancellation"),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    inv = billing_service.cancel_invoice(
        tenant_id=tenant.id,
        doctor_id=current_doctor.id,
        invoice_id=invoice_id,
        reason=reason,
        db=db,
    )
    return InvoiceResponse.model_validate(inv)


@router.post("/invoices/{invoice_id}/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED, summary="Record Payment")
def record_payment(
    invoice_id: uuid.UUID,
    payload: PaymentCreateRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> PaymentResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    pmt = billing_service.record_payment(
        tenant_id=tenant.id,
        doctor_id=current_doctor.id,
        invoice_id=invoice_id,
        payload=payload,
        db=db,
    )
    return PaymentResponse.model_validate(pmt)


@router.post("/refunds", response_model=RefundResponse, status_code=status.HTTP_201_CREATED, summary="Issue Refund")
def issue_refund(
    payload: RefundCreateRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> RefundResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    ref = billing_service.refund_payment(
        tenant_id=tenant.id,
        doctor_id=current_doctor.id,
        payload=payload,
        db=db,
    )
    return RefundResponse.model_validate(ref)


# -----------------------------------------------------------------------------
# Shared Cross-Module Adapter Endpoint
# -----------------------------------------------------------------------------

@router.post("/add-to-invoice", response_model=InvoiceResponse, summary="Append Items from Any Module to Patient Invoice")
def add_to_patient_invoice(
    patient_name: str = Query(...),
    items: List[InvoiceItemInput] = ...,
    patient_contact: Optional[str] = Query(None),
    patient_email: Optional[str] = Query(None),
    appointment_id: Optional[uuid.UUID] = Query(None),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    inv = billing_service.add_to_invoice(
        tenant_id=tenant.id,
        doctor_id=current_doctor.id,
        patient_name=patient_name,
        items=items,
        patient_contact=patient_contact,
        patient_email=patient_email,
        appointment_id=appointment_id,
        db=db,
    )
    return InvoiceResponse.model_validate(inv)


# -----------------------------------------------------------------------------
# Service Catalog Endpoints
# -----------------------------------------------------------------------------

@router.get("/catalog", response_model=List[ServiceCatalogItemResponse], summary="List Clinic Service Catalog / Fees")
def list_service_catalog(
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> List[ServiceCatalogItemResponse]:
    tenant = _get_doctor_tenant(current_doctor, db)
    items = billing_service.list_service_catalog(tenant_id=tenant.id, db=db)
    return [ServiceCatalogItemResponse.model_validate(i) for i in items]


@router.post("/catalog", response_model=ServiceCatalogItemResponse, status_code=status.HTTP_201_CREATED, summary="Add Service to Catalog")
def create_service_catalog_item(
    payload: ServiceCatalogItemCreateRequest,
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> ServiceCatalogItemResponse:
    tenant = _get_doctor_tenant(current_doctor, db)
    item = billing_service.create_service_catalog_item(
        tenant_id=tenant.id,
        doctor_id=current_doctor.id,
        payload=payload,
        db=db,
    )
    return ServiceCatalogItemResponse.model_validate(item)


@router.post("/catalog/seed-defaults", response_model=List[ServiceCatalogItemResponse], summary="Seed Standard Clinic Service Fees")
def seed_default_catalog(
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
) -> List[ServiceCatalogItemResponse]:
    tenant = _get_doctor_tenant(current_doctor, db)
    items = billing_service.seed_default_service_catalog(
        tenant_id=tenant.id,
        doctor_id=current_doctor.id,
        db=db,
    )
    return [ServiceCatalogItemResponse.model_validate(i) for i in items]

