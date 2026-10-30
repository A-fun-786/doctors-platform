"""011_add_sent_at_to_verification_tokens

Revision ID: 011_add_sent_at_to_verification_tokens
Revises: 010_add_email_verification_and_security
Create Date: 2026-10-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "011_add_sent_at_to_verification_tokens"
down_revision: Union[str, None] = "010_add_email_verification_and_security"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("email_verification_tokens") as batch_op:
        batch_op.add_column(
            sa.Column(
                "sent_at",
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("email_verification_tokens") as batch_op:
        batch_op.drop_column("sent_at")
