"""012_multi_doctor_appointments

Revision ID: 012_multi_doctor_appointments
Revises: 011_staff_authentication
Create Date: 2026-11-05 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "012_multi_doctor_appointments"
down_revision: Union[str, None] = "011_staff_authentication"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.add_column(
            sa.Column("staff_id", sa.Uuid(), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_appointments_staff_id",
            "staff_members",
            ["staff_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.drop_index("uq_doctor_active_appointment_slot")
        batch_op.create_index(
            "uq_primary_doctor_active_slot",
            ["doctor_id", "date", "start_time"],
            unique=True,
            postgresql_where=sa.text("status != 'CANCELLED' AND staff_id IS NULL"),
            sqlite_where=sa.text("status != 'CANCELLED' AND staff_id IS NULL"),
        )
        batch_op.create_index(
            "uq_staff_doctor_active_slot",
            ["doctor_id", "staff_id", "date", "start_time"],
            unique=True,
            postgresql_where=sa.text("status != 'CANCELLED' AND staff_id IS NOT NULL"),
            sqlite_where=sa.text("status != 'CANCELLED' AND staff_id IS NOT NULL"),
        )
        batch_op.create_index(
            "ix_appointments_doctor_staff",
            ["doctor_id", "staff_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.drop_index("ix_appointments_doctor_staff")
        batch_op.drop_index("uq_staff_doctor_active_slot")
        batch_op.drop_index("uq_primary_doctor_active_slot")
        batch_op.create_index(
            "uq_doctor_active_appointment_slot",
            ["doctor_id", "date", "start_time"],
            unique=True,
            postgresql_where=sa.text("status != 'CANCELLED'"),
            sqlite_where=sa.text("status != 'CANCELLED'"),
        )
        batch_op.drop_constraint("fk_appointments_staff_id", type_="foreignkey")
        batch_op.drop_column("staff_id")

