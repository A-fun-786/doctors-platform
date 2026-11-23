"""010_add_email_verification_and_security

Revision ID: 010_add_email_verification_and_security
Revises: 009_add_working_hours_to_doctor
Create Date: 2026-10-29 20:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "010_add_email_verification_and_security"
down_revision: Union[str, None] = "009_add_working_hours_to_doctor"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add email verification and brute-force lockout columns to doctors
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.add_column(
            sa.Column(
                "email_verified",
                sa.Boolean(),
                server_default=sa.text("false"),
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column(
                "email_verified_at",
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )
        batch_op.add_column(
            sa.Column(
                "failed_login_attempts",
                sa.Integer(),
                server_default=sa.text("0"),
                nullable=False,
            )
        )
        batch_op.add_column(
            sa.Column(
                "locked_until",
                sa.DateTime(timezone=True),
                nullable=True,
            )
        )

    # 2. Backfill existing active doctors as email_verified=True
    dialect_name = op.get_context().dialect.name
    if dialect_name == "postgresql":
        op.execute(
            sa.text(
                "UPDATE doctors SET email_verified = true, email_verified_at = NOW() WHERE is_active = true"
            )
        )
    else:
        op.execute(
            sa.text(
                "UPDATE doctors SET email_verified = 1, email_verified_at = CURRENT_TIMESTAMP WHERE is_active = 1"
            )
        )

    # 3. Create email_verification_tokens table
    op.create_table(
        "email_verification_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("doctor_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False),
        sa.Column("purpose", sa.String(length=50), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["doctor_id"], ["doctors.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_email_verification_tokens_doctor_purpose",
        "email_verification_tokens",
        ["doctor_id", "purpose"],
        unique=False,
    )
    op.create_index(
        "ix_email_verification_tokens_token_hash",
        "email_verification_tokens",
        ["token_hash"],
        unique=False,
    )


def downgrade() -> None:
    # 1. Drop indexes and email_verification_tokens table
    op.drop_index(
        "ix_email_verification_tokens_token_hash",
        table_name="email_verification_tokens",
    )
    op.drop_index(
        "ix_email_verification_tokens_doctor_purpose",
        table_name="email_verification_tokens",
    )
    op.drop_table("email_verification_tokens")

    # 2. Drop columns from doctors
    with op.batch_alter_table("doctors") as batch_op:
        batch_op.drop_column("locked_until")
        batch_op.drop_column("failed_login_attempts")
        batch_op.drop_column("email_verified_at")
        batch_op.drop_column("email_verified")
