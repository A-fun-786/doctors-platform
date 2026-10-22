"""008_add_patient_details_to_appointments

Revision ID: 008_add_patient_details_to_appointments
Revises: 007_appointment_active_slot_unique_index
Create Date: 2026-10-22 15:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "008_add_patient_details_to_appointments"
down_revision: Union[str, None] = "007_appointment_active_slot_unique_index"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.add_column(sa.Column("patient_gender", sa.String(20), nullable=True))
        batch_op.add_column(sa.Column("patient_age", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("patient_height", sa.String(20), nullable=True))
        batch_op.add_column(sa.Column("patient_weight", sa.String(20), nullable=True))
        batch_op.add_column(sa.Column("patient_blood_group", sa.String(10), nullable=True))
        batch_op.add_column(sa.Column("patient_address", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.drop_column("patient_address")
        batch_op.drop_column("patient_blood_group")
        batch_op.drop_column("patient_weight")
        batch_op.drop_column("patient_height")
        batch_op.drop_column("patient_age")
        batch_op.drop_column("patient_gender")
