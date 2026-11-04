import uuid
import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import BigInteger, Boolean, Date, Float, ForeignKey, Index, Integer, String, Text, Uuid, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.doctor import Doctor
    from app.models.tenant import Tenant
    from app.models.appointment import Appointment


class ClinicServiceCatalog(Base, TimestampMixin):
    """Fee list and standard chargeable items for a clinic."""

    __tablename__ = "clinic_service_catalog"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    code: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        index=True,
    )
    category: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="consultation",
        index=True,
    )
    unit_price_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    tax_rate_percent: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
    )

    __table_args__ = (
        Index("ix_service_catalog_tenant_name", "tenant_id", "name"),
        Index("ix_service_catalog_tenant_category", "tenant_id", "category"),
    )


class ClinicInvoiceSequence(Base):
    """Atomic sequential invoice counter per clinic."""

    __tablename__ = "clinic_invoice_sequences"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False,
    )
    prefix: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="INV",
    )
    last_number: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    updated_at: Mapped[datetime.datetime] = mapped_column(
        default=datetime.datetime.utcnow,
        onupdate=datetime.datetime.utcnow,
    )


class Invoice(Base, TimestampMixin):
    """Patient invoice entity."""

    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    invoice_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    appointment_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("appointments.id", ondelete="SET NULL"),
        index=True,
        nullable=True,
    )
    patient_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    patient_contact: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    patient_email: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
        index=True,
    )
    subtotal_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    discount_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    tax_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    total_amount_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    paid_amount_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    balance_due_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    issue_date: Mapped[datetime.date] = mapped_column(
        Date,
        nullable=False,
        default=datetime.date.today,
    )
    due_date: Mapped[Optional[datetime.date]] = mapped_column(
        Date,
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    terms: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    items: Mapped[List["InvoiceItem"]] = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceItem.created_at.asc()",
    )
    payments: Mapped[List["Payment"]] = relationship(
        "Payment",
        back_populates="invoice",
        order_by="Payment.created_at.asc()",
    )

    __table_args__ = (
        Index("ix_invoices_tenant_status", "tenant_id", "status"),
        Index("ix_invoices_tenant_issue_date", "tenant_id", "issue_date"),
    )

    def recalculate_totals(self) -> None:
        """Compute subtotal, tax, total, paid, and balance due from line items and payments."""
        subtotal = 0
        tax = 0
        for item in self.items:
            subtotal += item.unit_price_paise * item.quantity - item.discount_paise
            tax += item.tax_amount_paise

        self.subtotal_paise = max(0, subtotal)
        self.tax_paise = max(0, tax)
        self.total_amount_paise = max(0, self.subtotal_paise - self.discount_paise + self.tax_paise)
        self.balance_due_paise = max(0, self.total_amount_paise - self.paid_amount_paise)

        if self.status not in ("draft", "cancelled", "refunded"):
            if self.paid_amount_paise >= self.total_amount_paise and self.total_amount_paise > 0:
                self.status = "paid"
            elif self.paid_amount_paise > 0:
                self.status = "partially_paid"
            else:
                self.status = "issued"


class InvoiceItem(Base, TimestampMixin):
    """Line item in an invoice."""

    __tablename__ = "invoice_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("invoices.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    source_module: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="other",
        index=True,
    )
    source_ref_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    description: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
    )
    unit_price_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    discount_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    tax_rate_percent: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    tax_amount_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )
    line_total_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        default=0,
    )

    invoice: Mapped["Invoice"] = relationship(
        "Invoice",
        back_populates="items",
    )

    def compute_line_total(self) -> None:
        """Calculate line item tax and total in integer paise."""
        base = max(0, (self.unit_price_paise * self.quantity) - self.discount_paise)
        if self.tax_rate_percent > 0:
            self.tax_amount_paise = round((base * self.tax_rate_percent) / 100.0)
        else:
            self.tax_amount_paise = 0
        self.line_total_paise = base + self.tax_amount_paise


class Payment(Base, TimestampMixin):
    """Immutable payment transaction recorded against an invoice."""

    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("invoices.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    amount_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    method: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="cash",
    )
    reference_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="success",
        index=True,
    )
    gateway: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True,
        default="manual",
    )
    gateway_order_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    gateway_payment_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    idempotency_key: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )

    invoice: Mapped["Invoice"] = relationship(
        "Invoice",
        back_populates="payments",
    )

    __table_args__ = (
        Index("ix_payments_tenant_method", "tenant_id", "method"),
        Index("ix_payments_tenant_created", "tenant_id", "created_at"),
    )


class Refund(Base, TimestampMixin):
    """Payment refund record."""

    __tablename__ = "refunds"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    payment_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("payments.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("invoices.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    amount_paise: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
    )
    reason: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    refund_reference: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="completed",
    )


class BillingAuditLog(Base):
    """Audit ledger tracking every invoice and payment mutation."""

    __tablename__ = "billing_audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    entity_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        index=True,
    )
    entity_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        nullable=False,
        index=True,
    )
    action: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
    )
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        nullable=True,
    )
    actor_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    metadata_json: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime.datetime] = mapped_column(
        default=datetime.datetime.utcnow,
        nullable=False,
    )

