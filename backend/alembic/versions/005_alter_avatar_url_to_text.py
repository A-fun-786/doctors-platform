"""005_alter_avatar_url_to_text

Revision ID: 005_alter_avatar_url_to_text
Revises: 004_add_app_icon_url
Create Date: 2026-09-26 12:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "005_alter_avatar_url_to_text"
down_revision: Union[str, None] = "004_add_app_icon_url"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.alter_column(
            "avatar_url",
            existing_type=sa.VARCHAR(length=500),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.alter_column(
            "avatar_url",
            existing_type=sa.Text(),
            type_=sa.VARCHAR(length=500),
            existing_nullable=True,
        )

