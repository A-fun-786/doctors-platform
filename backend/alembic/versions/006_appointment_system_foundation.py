"""006_appointment_system_foundation

Revision ID: 006_appointment_system_foundation
Revises: 005_alter_avatar_url_to_text
Create Date: 2026-10-04 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "006_appointment_system_foundation"
down_revision: Union[str, None] = "005_alter_avatar_url_to_text"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create schedules table
    op.create_table(
        "schedules",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("doctor_id", sa.Uuid(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("type", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_schedules_doctor_id"), "schedules", ["doctor_id"], unique=False)
    op.create_index("ix_schedules_doctor_date", "schedules", ["doctor_id", "date"], unique=False)

    # 2. Create appointments table
    op.create_table(
        "appointments",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("doctor_id", sa.Uuid(), nullable=False),
        sa.Column("patient_id", sa.Uuid(), nullable=True),
        sa.Column("request_id", sa.Uuid(), nullable=True),
        sa.Column("patient_name", sa.String(length=255), nullable=False),
        sa.Column("patient_contact", sa.String(length=100), nullable=True),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="BOOKED", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("doctor_id", "date", "start_time", name="uq_doctor_appointment_slot"),
    )
    op.create_index(op.f("ix_appointments_doctor_id"), "appointments", ["doctor_id"], unique=False)
    op.create_index("ix_appointments_doctor_date", "appointments", ["doctor_id", "date"], unique=False)
    op.create_index("ix_appointments_doctor_status", "appointments", ["doctor_id", "status"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_appointments_doctor_status", table_name="appointments")
    op.drop_index("ix_appointments_doctor_date", table_name="appointments")
    op.drop_index(op.f("ix_appointments_doctor_id"), table_name="appointments")
    op.drop_table("appointments")

    op.drop_index("ix_schedules_doctor_date", table_name="schedules")
    op.drop_index(op.f("ix_schedules_doctor_id"), table_name="schedules")
    op.drop_table("schedules")
