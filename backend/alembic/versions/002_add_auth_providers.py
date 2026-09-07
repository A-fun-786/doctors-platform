"""002_add_auth_providers

Revision ID: 002_add_auth_providers
Revises: 001_initial_foundation
Create Date: 2026-08-29 23:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "002_add_auth_providers"
down_revision: Union[str, None] = "001_initial_foundation"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add auth_provider, provider_id, avatar_url, and hashed_password columns to doctors table
    op.add_column(
        "doctors",
        sa.Column("avatar_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "doctors",
        sa.Column(
            "auth_provider",
            sa.String(length=50),
            server_default="google",
            nullable=False,
        ),
    )
    op.add_column(
        "doctors",
        sa.Column("provider_id", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "doctors",
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
    )
    op.create_index(
        op.f("ix_doctors_provider_id"), "doctors", ["provider_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_doctors_provider_id"), table_name="doctors")
    op.drop_column("doctors", "hashed_password")
    op.drop_column("doctors", "provider_id")
    op.drop_column("doctors", "auth_provider")
    op.drop_column("doctors", "avatar_url")
