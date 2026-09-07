"""004_add_app_icon_url

Revision ID: 004_add_app_icon_url
Revises: 003_add_doctor_onboarding_and_services
Create Date: 2026-09-06 23:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "004_add_app_icon_url"
down_revision: Union[str, None] = "003_add_doctor_onboarding_and_services"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "doctors",
        sa.Column("app_icon_url", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("doctors", "app_icon_url")

