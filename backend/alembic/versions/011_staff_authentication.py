"""011_staff_authentication

Revision ID: 011_staff_authentication
Revises: 010_staff_management
Create Date: 2026-11-05 02:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "011_staff_authentication"
down_revision: Union[str, None] = "010_staff_management"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "staff_members",
        sa.Column("can_login", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "staff_members",
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "staff_members",
        sa.Column("must_change_password", sa.Boolean(), nullable=False, server_default=sa.text("true")),
    )
    op.add_column(
        "staff_members",
        sa.Column("last_login_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("idx_staff_email", "staff_members", ["email"])


def downgrade() -> None:
    op.drop_index("idx_staff_email", table_name="staff_members")
    op.drop_column("staff_members", "last_login_at")
    op.drop_column("staff_members", "must_change_password")
    op.drop_column("staff_members", "hashed_password")
    op.drop_column("staff_members", "can_login")

