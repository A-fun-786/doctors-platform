import json
import uuid
from datetime import date, datetime
from typing import Optional, List, Dict
from fastapi import HTTPException, status
from sqlalchemy import or_, select, func
from sqlalchemy.orm import Session

from app.models.billing import (
    ClinicServiceCatalog,
    ClinicInvoiceSequence,
    Invoice,
    InvoiceItem,
    Payment,
    Refund,
    BillingAuditLog,
)
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
    BillingStatsResponse,
)
from app.services.payment_provider import get_payment_provider


def _log_audit(
    tenant_id: uuid.UUID,
    entity_type: str,
    entity_id: uuid.UUID,
    action: str,
    actor_id: Optional[uuid.UUID] = None,
    actor_name: Optional[str] = None,
    metadata: Optional[Dict] = None,
    db: Session = None,
) -> None:
    """Record an immutable audit log entry."""
    audit = BillingAuditLog(
        tenant_id=tenant_id,
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        actor_id=actor_id,
        actor_name=actor_name,
        metadata_json=json.dumps(metadata) if metadata else None,
    )
    db.add(audit)


def generate_invoice_number(tenant_id: uuid.UUID, db: Session) -> str:
    """Generate atomic sequential invoice number per clinic (e.g. INV-2026-0001)."""
    seq = db.scalar(
        select(ClinicInvoiceSequence).where(ClinicInvoiceSequence.tenant_id == tenant_id)
    )
    if not seq:
        seq = ClinicInvoiceSequence(
            tenant_id=tenant_id,
            prefix="INV",
            last_number=1,
        )
        db.add(seq)
    else:
        seq.last_number += 1

    year = date.today().year
    return f"{seq.prefix}-{year}-{seq.last_number:04d}"


def add_to_invoice(
    tenant_id: uuid.UUID,
    doctor_id: uuid.UUID,
    patient_name: str,
    items: List[InvoiceItemInput],
    patient_contact: Optional[str] = None,
    patient_email: Optional[str] = None,
    appointment_id: Optional[uuid.UUID] = None,
    db: Session = None,
) -> Invoice:
    """
    Shared cross-module adapter function.
    Any module (consultation, pharmacy, lab) can push items into a patient's bill
    without knowing billing internal logic.
    Appends to today's active draft invoice if exists; otherwise provisions a new one.
    """
    today = date.today()
    invoice = None
    if appointment_id:
        invoice = db.scalar(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.appointment_id == appointment_id,
                Invoice.status == "draft",
            )
        )

    if not invoice:
        # Search for an open draft for this patient on the same day
        invoice = db.scalar(
            select(Invoice).where(
                Invoice.tenant_id == tenant_id,
                Invoice.patient_name == patient_name.strip(),
                Invoice.issue_date == today,
                Invoice.status == "draft",
            )
        )

    if not invoice:
        invoice_number = generate_invoice_number(tenant_id, db)
        invoice = Invoice(
            tenant_id=tenant_id,
            doctor_id=doctor_id,
            invoice_number=invoice_number,
            appointment_id=appointment_id,
            patient_name=patient_name.strip(),
            patient_contact=patient_contact.strip() if patient_contact else None,
            patient_email=patient_email.strip() if patient_email else None,
            status="draft",
            issue_date=today,
        )
        db.add(invoice)
        db.flush()
        _log_audit(tenant_id, "invoice", invoice.id, "DRAFT_CREATED", actor_id=doctor_id, db=db)

    for item_input in items:
        item = InvoiceItem(
            invoice_id=invoice.id,
            tenant_id=tenant_id,
            source_module=item_input.source_module,
            source_ref_id=item_input.source_ref_id,
            description=item_input.description.strip(),
            quantity=item_input.quantity,
            unit_price_paise=item_input.unit_price_paise,
            discount_paise=item_input.discount_paise,
            tax_rate_percent=item_input.tax_rate_percent,
        )
        item.compute_line_total()
        invoice.items.append(item)
        db.add(item)

    invoice.recalculate_totals()
    db.commit()
    db.refresh(invoice)
    return invoice


def create_invoice(
    tenant_id: uuid.UUID,
    doctor_id: uuid.UUID,
    payload: InvoiceCreateRequest,
    db: Session,
) -> Invoice:
    """Explicitly create an invoice with line items."""
    invoice_number = generate_invoice_number(tenant_id, db)
    invoice = Invoice(
        tenant_id=tenant_id,
        doctor_id=doctor_id,
        invoice_number=invoice_number,
        appointment_id=payload.appointment_id,
        patient_name=payload.patient_name.strip(),
        patient_contact=payload.patient_contact.strip() if payload.patient_contact else None,
        patient_email=payload.patient_email.strip() if payload.patient_email else None,
        status="issued" if payload.auto_issue else "draft",
        issue_date=payload.issue_date or date.today(),
        due_date=payload.due_date,
        notes=payload.notes,
        terms=payload.terms,
        discount_paise=payload.discount_paise,
    )
    db.add(invoice)
    db.flush()

    for item_input in payload.items:
        item = InvoiceItem(
            invoice_id=invoice.id,
            tenant_id=tenant_id,
            source_module=item_input.source_module,
            source_ref_id=item_input.source_ref_id,
            description=item_input.description.strip(),
            quantity=item_input.quantity,
            unit_price_paise=item_input.unit_price_paise,
            discount_paise=item_input.discount_paise,
            tax_rate_percent=item_input.tax_rate_percent,
        )
        item.compute_line_total()
        invoice.items.append(item)
        db.add(item)

    invoice.recalculate_totals()
    _log_audit(
        tenant_id,
        "invoice",
        invoice.id,
        "ISSUED" if payload.auto_issue else "DRAFT_CREATED",
        actor_id=doctor_id,
        metadata={"total_amount_paise": invoice.total_amount_paise},
        db=db,
    )
    db.commit()
    db.refresh(invoice)
    return invoice


def get_invoice(tenant_id: uuid.UUID, invoice_id: uuid.UUID, db: Session) -> Invoice:
    """Retrieve an invoice scoped by clinic tenant."""
    invoice = db.scalar(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.tenant_id == tenant_id,
        )
    )
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invoice not found.",
        )
    return invoice


def update_invoice(
    tenant_id: uuid.UUID,
    doctor_id: uuid.UUID,
    invoice_id: uuid.UUID,
    payload: InvoiceUpdateRequest,
    db: Session,
) -> Invoice:
    """Update a draft invoice. Locked once issued."""
    invoice = get_invoice(tenant_id, invoice_id, db)

    if invoice.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit invoice #{invoice.invoice_number} because it is in '{invoice.status}' status. Issued invoices are locked; corrections must be made via cancellation or credit note.",
        )

    if payload.patient_name is not None:
        invoice.patient_name = payload.patient_name.strip()
    if payload.patient_contact is not None:
        invoice.patient_contact = payload.patient_contact.strip()
    if payload.patient_email is not None:
        invoice.patient_email = payload.patient_email.strip()
    if payload.due_date is not None:
        invoice.due_date = payload.due_date
    if payload.notes is not None:
        invoice.notes = payload.notes
    if payload.terms is not None:
        invoice.terms = payload.terms
    if payload.discount_paise is not None:
        invoice.discount_paise = payload.discount_paise

    if payload.items is not None:
        # Replace line items
        for old_item in invoice.items:
            db.delete(old_item)
        invoice.items.clear()

        for item_input in payload.items:
            item = InvoiceItem(
                invoice_id=invoice.id,
                tenant_id=tenant_id,
                source_module=item_input.source_module,
                source_ref_id=item_input.source_ref_id,
                description=item_input.description.strip(),
                quantity=item_input.quantity,
                unit_price_paise=item_input.unit_price_paise,
                discount_paise=item_input.discount_paise,
                tax_rate_percent=item_input.tax_rate_percent,
            )
            item.compute_line_total()
            invoice.items.append(item)
            db.add(item)

    invoice.recalculate_totals()
    _log_audit(
        tenant_id,
        "invoice",
        invoice.id,
        "DRAFT_UPDATED",
        actor_id=doctor_id,
        metadata={"total_amount_paise": invoice.total_amount_paise},
        db=db,
    )
    db.commit()
    db.refresh(invoice)
    return invoice


def issue_invoice(tenant_id: uuid.UUID, doctor_id: uuid.UUID, invoice_id: uuid.UUID, db: Session) -> Invoice:
    """Lock draft and mark as issued."""
    invoice = get_invoice(tenant_id, invoice_id, db)
    if invoice.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invoice is already {invoice.status}.",
        )
    invoice.status = "issued"
    invoice.recalculate_totals()
    _log_audit(tenant_id, "invoice", invoice.id, "ISSUED", actor_id=doctor_id, db=db)
    db.commit()
    db.refresh(invoice)
    return invoice


def cancel_invoice(
    tenant_id: uuid.UUID,
    doctor_id: uuid.UUID,
    invoice_id: uuid.UUID,
    reason: str,
    db: Session,
) -> Invoice:
    """Cancel an invoice. Blocked if payments exist without full refund."""
    invoice = get_invoice(tenant_id, invoice_id, db)
    if invoice.status in ("paid", "partially_paid") and invoice.paid_amount_paise > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel invoice #{invoice.invoice_number} with active payments. Please refund recorded payments first.",
        )
    invoice.status = "cancelled"
    invoice.balance_due_paise = 0
    _log_audit(
        tenant_id,
        "invoice",
        invoice.id,
        "CANCELLED",
        actor_id=doctor_id,
        metadata={"reason": reason},
        db=db,
    )
    db.commit()
    db.refresh(invoice)
    return invoice


def list_invoices(
    tenant_id: uuid.UUID,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = None,
) -> InvoiceListResponse:
    query = select(Invoice).where(Invoice.tenant_id == tenant_id)

    if status_filter and status_filter.lower() != "all":
        query = query.where(Invoice.status == status_filter.lower())

    if search:
        search_pattern = f"%{search.strip()}%"
        query = query.where(
            or_(
                Invoice.invoice_number.ilike(search_pattern),
                Invoice.patient_name.ilike(search_pattern),
                Invoice.patient_contact.ilike(search_pattern),
            )
        )

    invoices = db.scalars(query.order_by(Invoice.created_at.desc())).all()
    resp_invoices = [InvoiceResponse.model_validate(inv) for inv in invoices]
    return InvoiceListResponse(invoices=resp_invoices, total=len(resp_invoices))


def record_payment(
    tenant_id: uuid.UUID,
    doctor_id: uuid.UUID,
    invoice_id: uuid.UUID,
    payload: PaymentCreateRequest,
    db: Session,
) -> Payment:
    """Record an immutable payment against an invoice."""
    # 1. Idempotency check
    if payload.idempotency_key:
        existing = db.scalar(
            select(Payment).where(
                Payment.tenant_id == tenant_id,
                Payment.idempotency_key == payload.idempotency_key,
            )
        )
        if existing:
            return existing

    invoice = get_invoice(tenant_id, invoice_id, db)

    if invoice.status in ("cancelled", "refunded"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot record payment for an invoice in '{invoice.status}' status.",
        )

    # Auto-issue draft on payment
    if invoice.status == "draft":
        invoice.status = "issued"

    if payload.amount_paise > invoice.balance_due_paise:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment amount ({payload.amount_paise} paise) exceeds invoice balance due ({invoice.balance_due_paise} paise).",
        )

    # Process through payment provider
    provider = get_payment_provider(payload.gateway)
    res = provider.initiate_payment(
        amount_paise=payload.amount_paise,
        invoice_number=invoice.invoice_number,
        customer_info={"name": invoice.patient_name, "contact": invoice.patient_contact},
        idempotency_key=payload.idempotency_key,
    )

    payment = Payment(
        invoice_id=invoice.id,
        tenant_id=tenant_id,
        doctor_id=doctor_id,
        amount_paise=payload.amount_paise,
        method=payload.method,
        reference_number=payload.reference_number,
        notes=payload.notes,
        status="success" if res.success else "failed",
        gateway=res.gateway,
        gateway_order_id=res.gateway_order_id,
        gateway_payment_id=res.gateway_payment_id,
        idempotency_key=payload.idempotency_key,
    )
    db.add(payment)
    db.flush()

    if res.success:
        invoice.paid_amount_paise += payload.amount_paise
        invoice.recalculate_totals()

    _log_audit(
        tenant_id,
        "payment",
        payment.id,
        "PAYMENT_RECORDED",
        actor_id=doctor_id,
        metadata={
            "invoice_number": invoice.invoice_number,
            "amount_paise": payload.amount_paise,
            "method": payload.method,
            "balance_due_paise": invoice.balance_due_paise,
        },
        db=db,
    )
    db.commit()
    db.refresh(payment)
    return payment


def refund_payment(
    tenant_id: uuid.UUID,
    doctor_id: uuid.UUID,
    payload: RefundCreateRequest,
    db: Session,
) -> Refund:
    """Issue a refund against a previous payment."""
    payment = db.scalar(
        select(Payment).where(
            Payment.id == payload.payment_id,
            Payment.tenant_id == tenant_id,
        )
    )
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment transaction not found.",
        )

    if payment.status != "success":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only refund successful payments.",
        )

    if payload.amount_paise > payment.amount_paise:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Refund amount ({payload.amount_paise}) cannot exceed payment amount ({payment.amount_paise}).",
        )

    invoice = get_invoice(tenant_id, payment.invoice_id, db)

    refund = Refund(
        payment_id=payment.id,
        invoice_id=invoice.id,
        tenant_id=tenant_id,
        doctor_id=doctor_id,
        amount_paise=payload.amount_paise,
        reason=payload.reason,
        refund_reference=f"REF-{uuid.uuid4().hex[:8].upper()}",
        status="completed",
    )
    db.add(refund)
    db.flush()

    payment.status = "refunded"
    invoice.paid_amount_paise = max(0, invoice.paid_amount_paise - payload.amount_paise)
    invoice.recalculate_totals()
    if invoice.paid_amount_paise == 0:
        invoice.status = "refunded"

    _log_audit(
        tenant_id,
        "refund",
        refund.id,
        "REFUNDED",
        actor_id=doctor_id,
        metadata={"amount_paise": payload.amount_paise, "reason": payload.reason},
        db=db,
    )
    db.commit()
    db.refresh(refund)
    return refund


def get_billing_stats(tenant_id: uuid.UUID, db: Session) -> BillingStatsResponse:
    """Calculate aggregated billing and daily accounting figures."""
    today = date.today()

    invoices = db.scalars(select(Invoice).where(Invoice.tenant_id == tenant_id)).all()
    payments = db.scalars(select(Payment).where(Payment.tenant_id == tenant_id, Payment.status == "success")).all()
    items = db.scalars(select(InvoiceItem).where(InvoiceItem.tenant_id == tenant_id)).all()

    total_billed_paise = sum(inv.total_amount_paise for inv in invoices if inv.status != "cancelled")
    total_outstanding_paise = sum(inv.balance_due_paise for inv in invoices if inv.status not in ("cancelled", "refunded"))

    total_collected_today_paise = sum(
        p.amount_paise for p in payments if p.created_at.date() == today
    )

    pending_invoices_count = sum(
        1 for inv in invoices if inv.status in ("issued", "partially_paid") and inv.balance_due_paise > 0
    )

    # Collection by method
    collection_by_method: Dict[str, int] = {}
    for p in payments:
        method = p.method.lower()
        collection_by_method[method] = collection_by_method.get(method, 0) + p.amount_paise

    # Revenue by module
    revenue_by_module: Dict[str, int] = {}
    for it in items:
        mod = it.source_module.lower()
        revenue_by_module[mod] = revenue_by_module.get(mod, 0) + it.line_total_paise

    return BillingStatsResponse(
        total_billed_paise=total_billed_paise,
        total_collected_today_paise=total_collected_today_paise,
        total_outstanding_paise=total_outstanding_paise,
        invoices_count=len(invoices),
        pending_invoices_count=pending_invoices_count,
        collection_by_method=collection_by_method,
        revenue_by_module=revenue_by_module,
    )


# -----------------------------------------------------------------------------
# Service Catalog
# -----------------------------------------------------------------------------

def list_service_catalog(tenant_id: uuid.UUID, db: Session) -> List[ClinicServiceCatalog]:
    return db.scalars(
        select(ClinicServiceCatalog)
        .where(ClinicServiceCatalog.tenant_id == tenant_id, ClinicServiceCatalog.is_active == True)
        .order_by(ClinicServiceCatalog.category.asc(), ClinicServiceCatalog.name.asc())
    ).all()


def create_service_catalog_item(
    tenant_id: uuid.UUID,
    doctor_id: uuid.UUID,
    payload: ServiceCatalogItemCreateRequest,
    db: Session,
) -> ClinicServiceCatalog:
    item = ClinicServiceCatalog(
        tenant_id=tenant_id,
        doctor_id=doctor_id,
        name=payload.name.strip(),
        code=payload.code.strip() if payload.code else None,
        category=payload.category.strip().lower(),
        unit_price_paise=payload.unit_price_paise,
        tax_rate_percent=payload.tax_rate_percent,
        description=payload.description.strip() if payload.description else None,
        is_active=payload.is_active,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def seed_default_service_catalog(tenant_id: uuid.UUID, doctor_id: uuid.UUID, db: Session) -> List[ClinicServiceCatalog]:
    """Populate typical clinic fee structure if catalog is empty."""
    existing = list_service_catalog(tenant_id, db)
    if existing:
        return existing

    defaults = [
        ServiceCatalogItemCreateRequest(
            name="General Doctor Consultation",
            code="CONS-GEN",
            category="consultation",
            unit_price_paise=50000,  # ₹500.00
            tax_rate_percent=0.0,
            description="Standard in-clinic doctor consultation and physical examination.",
        ),
        ServiceCatalogItemCreateRequest(
            name="Follow-up Doctor Consultation",
            code="CONS-FOL",
            category="consultation",
            unit_price_paise=30000,  # ₹300.00
            tax_rate_percent=0.0,
            description="Follow-up consultation within 7 days of primary visit.",
        ),
        ServiceCatalogItemCreateRequest(
            name="Video Teleconsultation",
            code="CONS-VID",
            category="consultation",
            unit_price_paise=60000,  # ₹600.00
            tax_rate_percent=0.0,
            description="Remote telehealth video consultation.",
        ),
        ServiceCatalogItemCreateRequest(
            name="Complete Blood Count (CBC)",
            code="LAB-CBC",
            category="lab",
            unit_price_paise=35000,  # ₹350.00
            tax_rate_percent=0.0,
            description="Full automated hematology blood profile.",
        ),
        ServiceCatalogItemCreateRequest(
            name="Blood Sugar Fasting / Postprandial",
            code="LAB-BS",
            category="lab",
            unit_price_paise=15000,  # ₹150.00
            tax_rate_percent=0.0,
            description="Blood glucose level determination.",
        ),
        ServiceCatalogItemCreateRequest(
            name="Minor Wound Dressing & Bandage",
            code="PROC-DRS",
            category="procedure",
            unit_price_paise=25000,  # ₹250.00
            tax_rate_percent=5.0,
            description="Antiseptic wound cleansing and sterile dressing.",
        ),
        ServiceCatalogItemCreateRequest(
            name="ECG (12-Lead Electrocardiogram)",
            code="PROC-ECG",
            category="procedure",
            unit_price_paise=40000,  # ₹400.00
            tax_rate_percent=0.0,
            description="12-lead diagnostic cardiac rhythm scan.",
        ),
    ]

    items = []
    for d in defaults:
        item = create_service_catalog_item(tenant_id, doctor_id, d, db)
        items.append(item)
    return items
