import uuid
import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import Date, Float, ForeignKey, Index, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.models.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.doctor import Doctor
    from app.models.tenant import Tenant


class MedicineItem(Base, TimestampMixin):
    """Pharmacy medicine inventory item owned by a doctor/tenant."""

    __tablename__ = "medicine_items"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        index=True,
    )
    generic_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
        index=True,
    )
    category: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="General",
        index=True,
    )
    dosage_form: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="Tablet",
    )
    strength: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    sku: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
        index=True,
    )
    batch_number: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True,
    )
    stock_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
    min_stock_alert: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=10,
    )
    unit_price: Mapped[float] = mapped_column(
        Float,
        nullable=False,
        default=0.0,
    )
    expiry_date: Mapped[Optional[datetime.date]] = mapped_column(
        Date,
        nullable=True,
    )
    manufacturer: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True,
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="in_stock",
    )

    __table_args__ = (
        Index("ix_medicine_items_doctor_name", "doctor_id", "name"),
        Index("ix_medicine_items_doctor_category", "doctor_id", "category"),
    )

    def calculate_status(self) -> str:
        """Dynamically compute item stock status."""
        if self.stock_quantity <= 0:
            return "out_of_stock"
        if self.stock_quantity <= self.min_stock_alert:
            return "low_stock"
        return "in_stock"


class MedicineOrder(Base, TimestampMixin):
    """Patient medicine request or prescription fulfillment order."""

    __tablename__ = "medicine_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        Uuid,
        ForeignKey("doctors.id", ondelete="CASCADE"),
        index=True,
        nullable=False,
    )
    tenant_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        Uuid,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
        nullable=True,
    )
    order_number: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False,
    )
    patient_name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )
    patient_phone: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
    )
    delivery_address: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    medicines_text: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="received",
        index=True,
    )
    total_price: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True,
    )
    doctor_notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True,
    )

    __table_args__ = (
        Index("ix_medicine_orders_doctor_status", "doctor_id", "status"),
    )

