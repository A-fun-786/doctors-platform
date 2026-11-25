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
    # 1. Drop old case-sensitive unique index on username first (using IF EXISTS so PostgreSQL transactions are never aborted)
    op.execute(sa.text("DROP INDEX IF EXISTS idx_staff_username"))

    conn = op.get_bind()

    # 2. Deduplicate any pre-existing case-insensitive username collisions before lowercasing
    dup_usernames = conn.execute(
        sa.text(
            "SELECT id, LOWER(username) AS uname FROM staff_members "
            "WHERE username IS NOT NULL ORDER BY created_at ASC, id ASC"
        )
    ).fetchall()
    reserved_usernames: set[str] = {uname for _, uname in dup_usernames if uname}
    seen_usernames: set[str] = set()
    for row_id, uname in dup_usernames:
        if uname in seen_usernames:
            suffix = str(row_id).replace("-", "")[:6].lower()
            deduped = f"{uname[:52]}.{suffix}"
            counter = 1
            while deduped in reserved_usernames or deduped in seen_usernames:
                deduped = f"{uname[:50]}.{suffix}{counter}"
                counter += 1
            conn.execute(
                sa.text("UPDATE staff_members SET username = :uname WHERE id = :id"),
                {"uname": deduped, "id": row_id},
            )
            seen_usernames.add(deduped)
            reserved_usernames.add(deduped)
        else:
            seen_usernames.add(uname)

    # 3. Deduplicate any pre-existing case-insensitive login-enabled email collisions before lowercasing
    dup_emails = conn.execute(
        sa.text(
            "SELECT id, LOWER(email) AS em FROM staff_members "
            "WHERE email IS NOT NULL AND can_login = TRUE "
            "ORDER BY created_at ASC, id ASC"
        )
    ).fetchall()
    seen_emails: set[str] = set()
    for row_id, em in dup_emails:
        if em in seen_emails:
            conn.execute(
                sa.text("UPDATE staff_members SET email = NULL WHERE id = :id"),
                {"id": row_id},
            )
        else:
            seen_emails.add(em)

    # 4. Backfill and normalize existing usernames and emails to lowercase
    op.execute(sa.text("UPDATE staff_members SET username = LOWER(username) WHERE username IS NOT NULL"))
    op.execute(sa.text("UPDATE staff_members SET email = LOWER(email) WHERE email IS NOT NULL"))

    # 5. Create case-insensitive functional unique index on username
    op.create_index(
        "uq_staff_username_lower",
        "staff_members",
        [sa.text("LOWER(username)")],
        unique=True,
    )

    # 6. Create case-insensitive partial unique index on email for login-enabled staff
    op.create_index(
        "uq_staff_login_email_lower",
        "staff_members",
        [sa.text("LOWER(email)")],
        unique=True,
        postgresql_where=sa.text("can_login = TRUE AND email IS NOT NULL"),
        sqlite_where=sa.text("can_login = 1 AND email IS NOT NULL"),
    )


def downgrade() -> None:
    op.execute(sa.text("DROP INDEX IF EXISTS uq_staff_login_email_lower"))
    op.execute(sa.text("DROP INDEX IF EXISTS uq_staff_username_lower"))
    op.create_index("idx_staff_username", "staff_members", ["username"], unique=True)

