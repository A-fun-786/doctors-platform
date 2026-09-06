"""003_add_doctor_onboarding_and_services

Revision ID: 003_add_doctor_onboarding_and_services
Revises: 002_add_auth_providers
Create Date: 2026-09-06 21:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "003_add_doctor_onboarding_and_services"
down_revision: Union[str, None] = "002_add_auth_providers"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add doctor profile fields
    op.add_column(
        "doctors",
        sa.Column("speciality", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "doctors",
        sa.Column("bio", sa.Text(), nullable=True),
    )
    op.add_column(
        "doctors",
        sa.Column(
            "onboarding_completed",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )

    # 2. Add tenant clinic and services fields
    op.add_column(
        "tenants",
        sa.Column("clinic_name", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("location", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column(
            "service_appointment",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )
    op.add_column(
        "tenants",
        sa.Column(
            "service_video_consultation",
            sa.Boolean(),
            server_default=sa.text("true"),
            nullable=False,
        ),
    )
    op.add_column(
        "tenants",
        sa.Column(
            "service_medicine_inventory",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )
    op.add_column(
        "tenants",
        sa.Column(
            "service_lab_reports",
            sa.Boolean(),
            server_default=sa.text("false"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("tenants", "service_lab_reports")
    op.drop_column("tenants", "service_medicine_inventory")
    op.drop_column("tenants", "service_video_consultation")
    op.drop_column("tenants", "service_appointment")
    op.drop_column("tenants", "location")
    op.drop_column("tenants", "clinic_name")

    op.drop_column("doctors", "onboarding_completed")
    op.drop_column("doctors", "bio")
    op.drop_column("doctors", "speciality")
