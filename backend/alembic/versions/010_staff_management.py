"""010_staff_management

Revision ID: 010_staff_management
Revises: 009_add_working_hours_to_doctor
Create Date: 2026-11-05 01:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "010_staff_management"
down_revision: Union[str, None] = "009_add_working_hours_to_doctor"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # staff_members
    op.create_table(
        "staff_members",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("doctor_id", sa.UUID(), sa.ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("phone", sa.String(length=30), nullable=False),
        sa.Column("role", sa.String(length=50), nullable=False),
        sa.Column("department", sa.String(length=50), nullable=False, server_default="Clinical"),
        sa.Column("employment_type", sa.String(length=30), nullable=False, server_default="full_time"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="active"),
        sa.Column("joining_date", sa.Date(), nullable=False),
        sa.Column("base_salary_paise", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("emergency_contact", sa.String(length=100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("idx_staff_doctor_status", "staff_members", ["doctor_id", "status"])
    op.create_index("idx_staff_doctor_dept", "staff_members", ["doctor_id", "department"])


def downgrade() -> None:
    op.drop_table("staff_members")
