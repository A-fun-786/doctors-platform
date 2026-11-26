"""009_add_working_hours_to_doctor

Revision ID: 009_add_working_hours_to_doctor
Revises: 008_add_patient_details_to_appointments
Create Date: 2026-10-25 21:00:00.000000

"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "009_add_working_hours_to_doctor"
down_revision: Union[str, None] = "008_add_patient_details_to_appointments"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_WORKING_HOURS = {
    "shifts": [
        {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
        {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": True},
    ],
    "closed_days": [0],
}


def upgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.add_column(sa.Column("working_hours", sa.JSON(), nullable=True))

    default_json = json.dumps(DEFAULT_WORKING_HOURS)
    dialect_name = op.get_context().dialect.name
    if dialect_name == "postgresql":
        op.execute(
            sa.text("UPDATE doctors SET working_hours = CAST(:val AS json) WHERE working_hours IS NULL").bindparams(val=default_json)
        )
    else:
        op.execute(
            sa.text("UPDATE doctors SET working_hours = :val WHERE working_hours IS NULL").bindparams(val=default_json)
        )


def downgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("working_hours")
