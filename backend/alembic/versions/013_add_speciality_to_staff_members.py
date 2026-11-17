"""013_add_speciality_to_staff_members

Revision ID: 013_add_speciality_to_staff_members
Revises: 012_multi_doctor_appointments
Create Date: 2026-11-17 06:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "013_add_speciality_to_staff_members"
down_revision: Union[str, None] = "012_multi_doctor_appointments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("staff_members") as batch_op:
        batch_op.add_column(
            sa.Column("speciality", sa.String(length=100), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("staff_members") as batch_op:
        batch_op.drop_column("speciality")

