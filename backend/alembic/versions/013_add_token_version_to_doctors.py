"""013_add_token_version_to_doctors

Revision ID: 013_add_token_version_to_doctors
Revises: 012_add_password_reset_purpose_support
Create Date: 2026-11-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "013_add_token_version_to_doctors"
down_revision: Union[str, None] = "012_add_password_reset_purpose_support"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.add_column(
            sa.Column(
                "token_version",
                sa.Integer(),
                nullable=False,
                server_default=sa.text("1"),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("token_version")
