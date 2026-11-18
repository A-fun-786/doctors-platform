"""012_multi_doctor_appointments

Revision ID: 012_multi_doctor_appointments
Revises: 011_staff_authentication
Create Date: 2026-11-05 20:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "012_multi_doctor_appointments"
down_revision: Union[str, None] = "011_staff_authentication"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("appointments") as batch_op:
        batch_op.add_column(
            sa.Column("staff_id", sa.Uuid(), nullable=True)
        )
        batch_op.create_foreign_key(
            "fk_appointments_staff_id",
            "staff_members",
            ["staff_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.drop_index("uq_doctor_active_appointment_slot")
        batch_op.create_index(
            "uq_primary_doctor_active_slot",
            ["doctor_id", "date", "start_time"],
            unique=True,
            postgresql_where=sa.text("status != 'CANCELLED' AND staff_id IS NULL"),
            sqlite_where=sa.text("status != 'CANCELLED' AND staff_id IS NULL"),
        )
        batch_op.create_index(
            "uq_staff_doctor_active_slot",
            ["doctor_id", "staff_id", "date", "start_time"],
            unique=True,
            postgresql_where=sa.text("status != 'CANCELLED' AND staff_id IS NOT NULL"),
            sqlite_where=sa.text("status != 'CANCELLED' AND staff_id IS NOT NULL"),
        )
        batch_op.create_index(
            "ix_appointments_doctor_staff",
            ["doctor_id", "staff_id"],
        )

    dialect_name = op.get_context().dialect.name
    if dialect_name == "postgresql":
        op.execute("CREATE EXTENSION IF NOT EXISTS btree_gist;")
        op.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_primary_doctor_no_overlap'
                ) THEN
                    ALTER TABLE appointments ADD CONSTRAINT uq_primary_doctor_no_overlap
                    EXCLUDE USING gist (
                        doctor_id WITH =,
                        (tsrange(date + start_time, date + end_time, '[)')) WITH &&
                    ) WHERE (status != 'CANCELLED' AND staff_id IS NULL);
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'uq_staff_doctor_no_overlap'
                ) THEN
                    ALTER TABLE appointments ADD CONSTRAINT uq_staff_doctor_no_overlap
                    EXCLUDE USING gist (
                        doctor_id WITH =,
                        staff_id WITH =,
                        (tsrange(date + start_time, date + end_time, '[)')) WITH &&
                    ) WHERE (status != 'CANCELLED' AND staff_id IS NOT NULL);
                END IF;
            END $$;
        """)
    elif dialect_name == "sqlite":
        op.execute("""
            CREATE TRIGGER IF NOT EXISTS trg_appointment_no_overlap_insert
            BEFORE INSERT ON appointments
            FOR EACH ROW
            WHEN NEW.status != 'CANCELLED'
            BEGIN
                SELECT RAISE(ABORT, 'Slot overlap detected: practitioner already booked')
                WHERE EXISTS (
                    SELECT 1 FROM appointments
                    WHERE doctor_id = NEW.doctor_id
                      AND date = NEW.date
                      AND status != 'CANCELLED'
                      AND start_time < NEW.end_time
                      AND end_time > NEW.start_time
                      AND (
                          (NEW.staff_id IS NULL AND staff_id IS NULL)
                          OR (NEW.staff_id IS NOT NULL AND staff_id = NEW.staff_id)
                      )
                );
            END;
        """)
        op.execute("""
            CREATE TRIGGER IF NOT EXISTS trg_appointment_no_overlap_update
            BEFORE UPDATE ON appointments
            FOR EACH ROW
            WHEN NEW.status != 'CANCELLED'
            BEGIN
                SELECT RAISE(ABORT, 'Slot overlap detected: practitioner already booked')
                WHERE EXISTS (
                    SELECT 1 FROM appointments
                    WHERE id != NEW.id
                      AND doctor_id = NEW.doctor_id
                      AND date = NEW.date
                      AND status != 'CANCELLED'
                      AND start_time < NEW.end_time
                      AND end_time > NEW.start_time
                      AND (
                          (NEW.staff_id IS NULL AND staff_id IS NULL)
                          OR (NEW.staff_id IS NOT NULL AND staff_id = NEW.staff_id)
                      )
                );
            END;
        """)


def downgrade() -> None:
    dialect_name = op.get_context().dialect.name
    if dialect_name == "postgresql":
        op.execute("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS uq_staff_doctor_no_overlap;")
        op.execute("ALTER TABLE appointments DROP CONSTRAINT IF EXISTS uq_primary_doctor_no_overlap;")
    elif dialect_name == "sqlite":
        op.execute("DROP TRIGGER IF EXISTS trg_appointment_no_overlap_update;")
        op.execute("DROP TRIGGER IF EXISTS trg_appointment_no_overlap_insert;")

    with op.batch_alter_table("appointments") as batch_op:
        batch_op.drop_index("ix_appointments_doctor_staff")
        batch_op.drop_index("uq_staff_doctor_active_slot")
        batch_op.drop_index("uq_primary_doctor_active_slot")
        batch_op.create_index(
            "uq_doctor_active_appointment_slot",
            ["doctor_id", "date", "start_time"],
            unique=True,
            postgresql_where=sa.text("status != 'CANCELLED'"),
            sqlite_where=sa.text("status != 'CANCELLED'"),
        )
        batch_op.drop_constraint("fk_appointments_staff_id", type_="foreignkey")
        batch_op.drop_column("staff_id")

