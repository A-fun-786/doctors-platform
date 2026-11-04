import uuid
from datetime import date, datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field

MedicineStatus = Literal["in_stock", "low_stock", "out_of_stock", "discontinued"]
OrderStatus = Literal["received", "processing", "dispensed", "completed", "cancelled"]


class MedicineItemCreateRequest(BaseModel):
    """Payload to add a new medicine to inventory."""
    name: str = Field(..., min_length=1, max_length=255)
    generic_name: Optional[str] = Field(None, max_length=255)
    category: str = Field("General", max_length=100)
    dosage_form: str = Field("Tablet", max_length=50)
    strength: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    batch_number: Optional[str] = Field(None, max_length=100)
    stock_quantity: int = Field(0, ge=0)
    min_stock_alert: int = Field(10, ge=0)
    unit_price: float = Field(0.0, ge=0.0)
    expiry_date: Optional[date] = None
    manufacturer: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None


class MedicineItemUpdateRequest(BaseModel):
    """Payload to update an existing medicine item."""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    generic_name: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = Field(None, max_length=100)
    dosage_form: Optional[str] = Field(None, max_length=50)
    strength: Optional[str] = Field(None, max_length=100)
    sku: Optional[str] = Field(None, max_length=100)
    batch_number: Optional[str] = Field(None, max_length=100)
    stock_quantity: Optional[int] = Field(None, ge=0)
    min_stock_alert: Optional[int] = Field(None, ge=0)
    unit_price: Optional[float] = Field(None, ge=0.0)
    expiry_date: Optional[date] = None
    manufacturer: Optional[str] = Field(None, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None


class StockAdjustmentRequest(BaseModel):
    """Payload to adjust stock quantity (+ or -)."""
    adjustment: int = Field(..., description="Quantity to add (positive) or deduct (negative)")
    reason: Optional[str] = Field(None, max_length=255)


class MedicineItemResponse(BaseModel):
    """Complete medicine item response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doctor_id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    name: str
    generic_name: Optional[str] = None
    category: str
    dosage_form: str
    strength: Optional[str] = None
    sku: Optional[str] = None
    batch_number: Optional[str] = None
    stock_quantity: int
    min_stock_alert: int
    unit_price: float
    expiry_date: Optional[date] = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    status: str
    is_expiring_soon: bool = False
    is_expired: bool = False
    created_at: datetime
    updated_at: datetime


class MedicineItemListResponse(BaseModel):
    """Paginated or listed medicines with aggregate count."""
    items: List[MedicineItemResponse]
    total: int


class MedicineOrderStatusUpdateRequest(BaseModel):
    """Payload to update order status or fulfillment notes."""
    status: OrderStatus
    doctor_notes: Optional[str] = None
    total_price: Optional[float] = Field(None, ge=0.0)


class MedicineOrderResponse(BaseModel):
    """Full order response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doctor_id: uuid.UUID
    tenant_id: Optional[uuid.UUID] = None
    order_number: str
    patient_name: str
    patient_phone: str
    delivery_address: str
    medicines_text: str
    status: str
    total_price: Optional[float] = None
    doctor_notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class MedicineOrderListResponse(BaseModel):
    orders: List[MedicineOrderResponse]
    total: int


class PharmacyStatsResponse(BaseModel):
    total_medicines: int
    total_units_in_stock: int
    low_stock_count: int
    out_of_stock_count: int
    expiring_soon_count: int
    pending_orders_count: int
    total_orders_count: int

