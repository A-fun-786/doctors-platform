"""010_pharmacy_and_inventory

Revision ID: 010_pharmacy_and_inventory
Revises: 009_add_working_hours_to_doctor
Create Date: 2026-11-04 02:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "010_pharmacy_and_inventory"
down_revision: Union[str, None] = "009_add_working_hours_to_doctor"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "medicine_items",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("doctor_id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("generic_name", sa.String(length=255), nullable=True),
        sa.Column("category", sa.String(length=100), nullable=False),
        sa.Column("dosage_form", sa.String(length=50), nullable=False),
        sa.Column("strength", sa.String(length=100), nullable=True),
        sa.Column("sku", sa.String(length=100), nullable=True),
        sa.Column("batch_number", sa.String(length=100), nullable=True),
        sa.Column("stock_quantity", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("min_stock_alert", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("unit_price", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("manufacturer", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="in_stock"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_medicine_items_doctor_id"), "medicine_items", ["doctor_id"], unique=False)
    op.create_index(op.f("ix_medicine_items_tenant_id"), "medicine_items", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_medicine_items_name"), "medicine_items", ["name"], unique=False)
    op.create_index(op.f("ix_medicine_items_generic_name"), "medicine_items", ["generic_name"], unique=False)
    op.create_index(op.f("ix_medicine_items_category"), "medicine_items", ["category"], unique=False)
    op.create_index(op.f("ix_medicine_items_sku"), "medicine_items", ["sku"], unique=False)
    op.create_index("ix_medicine_items_doctor_name", "medicine_items", ["doctor_id", "name"], unique=False)
    op.create_index("ix_medicine_items_doctor_category", "medicine_items", ["doctor_id", "category"], unique=False)

    op.create_table(
        "medicine_orders",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("doctor_id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=True),
        sa.Column("order_number", sa.String(length=50), nullable=False),
        sa.Column("patient_name", sa.String(length=255), nullable=False),
        sa.Column("patient_phone", sa.String(length=100), nullable=False),
        sa.Column("delivery_address", sa.Text(), nullable=False),
        sa.Column("medicines_text", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False, server_default="received"),
        sa.Column("total_price", sa.Float(), nullable=True),
        sa.Column("doctor_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_number"),
    )
    op.create_index(op.f("ix_medicine_orders_doctor_id"), "medicine_orders", ["doctor_id"], unique=False)
    op.create_index(op.f("ix_medicine_orders_tenant_id"), "medicine_orders", ["tenant_id"], unique=False)
    op.create_index(op.f("ix_medicine_orders_order_number"), "medicine_orders", ["order_number"], unique=True)
    op.create_index(op.f("ix_medicine_orders_status"), "medicine_orders", ["status"], unique=False)
    op.create_index("ix_medicine_orders_doctor_status", "medicine_orders", ["doctor_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_table("medicine_orders")
    op.drop_table("medicine_items")

