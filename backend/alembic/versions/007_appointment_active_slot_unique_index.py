"""007_appointment_active_slot_unique_index

Revision ID: 007_appointment_active_slot_unique_index
Revises: 006_appointment_system_foundation
Create Date: 2026-10-06 22:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "007_appointment_active_slot_unique_index"
down_revision: Union[str, None] = "006_appointment_system_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.drop_constraint("uq_doctor_appointment_slot", type_="unique")
        batch_op.create_index(
            "uq_doctor_active_appointment_slot",
            ["doctor_id", "date", "start_time"],
            unique=True,
            postgresql_where=sa.text("status != 'CANCELLED'"),
            sqlite_where=sa.text("status != 'CANCELLED'"),
        )


def downgrade() -> None:
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.drop_index("uq_doctor_active_appointment_slot")
        batch_op.create_unique_constraint(
            "uq_doctor_appointment_slot",
            ["doctor_id", "date", "start_time"],
        )
