import uuid
from datetime import date, datetime
from typing import Optional, List, Dict, Any, Literal
from pydantic import BaseModel, ConfigDict, Field

InvoiceStatus = Literal["draft", "issued", "partially_paid", "paid", "cancelled", "refunded"]
PaymentMethod = Literal["cash", "upi", "card", "online", "netbanking", "cheque"]
ItemModule = Literal["consultation", "pharmacy", "lab", "checkup", "procedure", "other"]


class ServiceCatalogItemCreateRequest(BaseModel):
    """Payload to add a service/fee to clinic catalog."""
    name: str = Field(..., min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    category: str = Field("consultation", max_length=50)
    unit_price_paise: int = Field(..., ge=0, description="Unit price in integer paise (e.g. 50000 for ₹500.00)")
    tax_rate_percent: float = Field(0.0, ge=0.0, le=100.0)
    description: Optional[str] = None
    is_active: bool = True


class ServiceCatalogItemUpdateRequest(BaseModel):
    """Payload to update catalog item."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    code: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = Field(None, max_length=50)
    unit_price_paise: Optional[int] = Field(None, ge=0)
    tax_rate_percent: Optional[float] = Field(None, ge=0.0, le=100.0)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceCatalogItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    doctor_id: uuid.UUID
    name: str
    code: Optional[str] = None
    category: str
    unit_price_paise: int
    tax_rate_percent: float
    description: Optional[str] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class InvoiceItemInput(BaseModel):
    """Line item input when building or adding to invoice."""
    source_module: str = Field("other", max_length=50)
    source_ref_id: Optional[str] = Field(None, max_length=100)
    description: str = Field(..., min_length=1, max_length=255)
    quantity: int = Field(1, ge=1)
    unit_price_paise: int = Field(..., ge=0)
    discount_paise: int = Field(0, ge=0)
    tax_rate_percent: float = Field(0.0, ge=0.0, le=100.0)


class InvoiceItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_id: uuid.UUID
    source_module: str
    source_ref_id: Optional[str] = None
    description: str
    quantity: int
    unit_price_paise: int
    discount_paise: int
    tax_rate_percent: float
    tax_amount_paise: int
    line_total_paise: int
    created_at: datetime


class PaymentCreateRequest(BaseModel):
    """Payload to record a payment against an invoice."""
    amount_paise: int = Field(..., gt=0, description="Payment amount in integer paise")
    method: str = Field("cash", description="cash, upi, card, online, netbanking, cheque")
    reference_number: Optional[str] = Field(None, max_length=100, description="Transaction ref/UTR/auth code")
    notes: Optional[str] = None
    gateway: Optional[str] = "manual"
    gateway_order_id: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    idempotency_key: Optional[str] = Field(None, max_length=100)


class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    invoice_id: uuid.UUID
    tenant_id: uuid.UUID
    doctor_id: uuid.UUID
    amount_paise: int
    method: str
    reference_number: Optional[str] = None
    notes: Optional[str] = None
    status: str
    gateway: Optional[str] = None
    gateway_order_id: Optional[str] = None
    gateway_payment_id: Optional[str] = None
    created_at: datetime


class RefundCreateRequest(BaseModel):
    """Payload to refund a payment."""
    payment_id: uuid.UUID
    amount_paise: int = Field(..., gt=0)
    reason: str = Field(..., min_length=3, max_length=255)


class RefundResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    payment_id: uuid.UUID
    invoice_id: uuid.UUID
    amount_paise: int
    reason: str
    refund_reference: Optional[str] = None
    status: str
    created_at: datetime


class InvoiceCreateRequest(BaseModel):
    """Payload to generate a new invoice."""
    patient_name: str = Field(..., min_length=1, max_length=255)
    patient_contact: Optional[str] = Field(None, max_length=100)
    patient_email: Optional[str] = Field(None, max_length=255)
    appointment_id: Optional[uuid.UUID] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    discount_paise: int = Field(0, ge=0)
    items: List[InvoiceItemInput] = Field(default_factory=list)
    auto_issue: bool = False


class InvoiceUpdateRequest(BaseModel):
    """Payload to update an editable draft invoice."""
    patient_name: Optional[str] = Field(None, min_length=1, max_length=255)
    patient_contact: Optional[str] = Field(None, max_length=100)
    patient_email: Optional[str] = Field(None, max_length=255)
    due_date: Optional[date] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    discount_paise: Optional[int] = Field(None, ge=0)
    items: Optional[List[InvoiceItemInput]] = None


class InvoiceResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    doctor_id: uuid.UUID
    invoice_number: str
    appointment_id: Optional[uuid.UUID] = None
    patient_name: str
    patient_contact: Optional[str] = None
    patient_email: Optional[str] = None
    status: str
    subtotal_paise: int
    discount_paise: int
    tax_paise: int
    total_amount_paise: int
    paid_amount_paise: int
    balance_due_paise: int
    issue_date: date
    due_date: Optional[date] = None
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[InvoiceItemResponse] = Field(default_factory=list)
    payments: List[PaymentResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class InvoiceListResponse(BaseModel):
    invoices: List[InvoiceResponse]
    total: int


class BillingStatsResponse(BaseModel):
    total_billed_paise: int
    total_collected_today_paise: int
    total_outstanding_paise: int
    invoices_count: int
    pending_invoices_count: int
    collection_by_method: Dict[str, int]
    revenue_by_module: Dict[str, int]

