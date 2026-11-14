"""012_add_password_reset_purpose_support

Revision ID: 012_add_password_reset_purpose_support
Revises: 011_add_sent_at_to_verification_tokens
Create Date: 2026-11-14 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "012_add_password_reset_purpose_support"
down_revision: Union[str, None] = "011_add_sent_at_to_verification_tokens"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("email_verification_tokens") as batch_op:
        batch_op.create_index(
            "ix_evt_doctor_purpose_reset",
            ["doctor_id", "purpose"],
            unique=False,
            postgresql_where=sa.text("purpose = 'password_reset'"),
            sqlite_where=sa.text("purpose = 'password_reset'"),
        )


def downgrade() -> None:
    with op.batch_alter_table("email_verification_tokens") as batch_op:
        batch_op.drop_index("ix_evt_doctor_purpose_reset")
