"""015_staff_case_insensitive_unique_indexes

Revision ID: 015_staff_case_insensitive_unique_indexes
Revises: 014_add_idempotency_records
Create Date: 2026-11-24 20:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "015_staff_case_insensitive_unique_indexes"
down_revision: Union[str, None] = "014_add_idempotency_records"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Drop old case-sensitive unique index on username first so normalization does not collide on it
    try:
        op.drop_index("idx_staff_username", table_name="staff_members")
    except Exception:
        pass

    # 2. Deduplicate any pre-existing case-insensitive username collisions before lowercasing
    conn = op.get_bind()
    dup_usernames = conn.execute(
        sa.text(
            "SELECT id, LOWER(username) AS uname FROM staff_members "
            "WHERE username IS NOT NULL ORDER BY created_at ASC, id ASC"
        )
    ).fetchall()
    seen_usernames: set[str] = set()
    for row_id, uname in dup_usernames:
        if uname in seen_usernames:
            suffix = str(row_id).replace("-", "")[:6].lower()
            deduped = f"{uname[:52]}.{suffix}"
            conn.execute(
                sa.text("UPDATE staff_members SET username = :uname WHERE id = :id"),
                {"uname": deduped, "id": row_id},
            )
            seen_usernames.add(deduped)
        else:
            seen_usernames.add(uname)

    # 3. Backfill and normalize existing usernames and emails to lowercase
    op.execute(sa.text("UPDATE staff_members SET username = LOWER(username) WHERE username IS NOT NULL"))
    op.execute(sa.text("UPDATE staff_members SET email = LOWER(email) WHERE email IS NOT NULL"))

    # 4. Create case-insensitive functional unique index on username
    op.create_index(
        "uq_staff_username_lower",
        "staff_members",
        [sa.text("LOWER(username)")],
        unique=True,
    )

    # 5. Create case-insensitive partial unique index on email for login-enabled staff
    op.create_index(
        "uq_staff_login_email_lower",
        "staff_members",
        [sa.text("LOWER(email)")],
        unique=True,
        postgresql_where=sa.text("can_login = TRUE AND email IS NOT NULL"),
        sqlite_where=sa.text("can_login = 1 AND email IS NOT NULL"),
    )


def downgrade() -> None:
    try:
        op.drop_index("uq_staff_login_email_lower", table_name="staff_members")
    except Exception:
        pass
    try:
        op.drop_index("uq_staff_username_lower", table_name="staff_members")
    except Exception:
        pass
    op.create_index("idx_staff_username", "staff_members", ["username"], unique=True)

