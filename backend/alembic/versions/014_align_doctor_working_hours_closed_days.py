"""014_align_doctor_working_hours_closed_days

Revision ID: 014_align_doctor_working_hours_closed_days
Revises: 013_add_token_version_to_doctors
Create Date: 2026-11-26 15:08:00.000000

Forward migration to align existing doctor working_hours.closed_days:
- Replaces legacy default [0] (from 009) and legacy ISO Sunday [6] with []
  so Sunday appointments are permitted by default and day indexing matches JS getDay() (0=Sun..6=Sat).
"""
import json
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "014_align_doctor_working_hours_closed_days"
down_revision: Union[str, None] = "013_add_token_version_to_doctors"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _rewrite_closed_days(target_from: tuple[list[int], ...], target_to: list[int]) -> None:
    conn = op.get_bind()
    dialect_name = op.get_context().dialect.name
    rows = conn.execute(
        sa.text("SELECT id, working_hours FROM doctors WHERE working_hours IS NOT NULL")
    ).fetchall()

    update_sql = (
        "UPDATE doctors SET working_hours = CAST(:val AS json) WHERE id = :doc_id"
        if dialect_name == "postgresql"
        else "UPDATE doctors SET working_hours = :val WHERE id = :doc_id"
    )

    for doc_id, raw_wh in rows:
        wh = json.loads(raw_wh) if isinstance(raw_wh, str) else raw_wh
        if not isinstance(wh, dict):
            continue
        if wh.get("closed_days") in target_from:
            updated = dict(wh)
            updated["closed_days"] = list(target_to)
            conn.execute(
                sa.text(update_sql).bindparams(
                    val=json.dumps(updated),
                    doc_id=doc_id,
                )
            )


def upgrade() -> None:
    _rewrite_closed_days(([0], [6]), [])


def downgrade() -> None:
    _rewrite_closed_days(([],), [0])
