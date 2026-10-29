import os
import uuid
import tempfile
from datetime import datetime, timezone, timedelta
import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from alembic.config import Config
from alembic import command

from app.models.base import Base
from app.models.doctor import Doctor
from app.models.verification_token import EmailVerificationToken


TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


def test_doctor_email_verification_and_lockout_fields(db_session):
    """Test Doctor model email verification and lockout fields and defaults."""
    doctor = Doctor(
        email="verify.test@example.com",
        full_name="Dr. Verify Test",
        auth_provider="email",
    )
    db_session.add(doctor)
    db_session.commit()
    db_session.refresh(doctor)

    # Check defaults
    assert doctor.email_verified is False
    assert doctor.email_verified_at is None
    assert doctor.failed_login_attempts == 0
    assert doctor.locked_until is None

    # Update fields
    now = datetime.now(timezone.utc)
    lockout_time = now + timedelta(minutes=15)
    doctor.email_verified = True
    doctor.email_verified_at = now
    doctor.failed_login_attempts = 3
    doctor.locked_until = lockout_time

    db_session.commit()
    db_session.refresh(doctor)

    assert doctor.email_verified is True
    assert doctor.email_verified_at is not None
    assert doctor.failed_login_attempts == 3
    assert doctor.locked_until is not None


def test_email_verification_token_lifecycle_and_cascade(db_session):
    """Test EmailVerificationToken creation, relationships, and cascade deletion."""
    doctor = Doctor(
        email="token.doctor@example.com",
        full_name="Dr. Token",
        auth_provider="email",
    )
    db_session.add(doctor)
    db_session.commit()
    db_session.refresh(doctor)

    expires = datetime.now(timezone.utc) + timedelta(minutes=15)
    token = EmailVerificationToken(
        doctor_id=doctor.id,
        token_hash="a" * 64,
        purpose="email_verification",
        expires_at=expires,
    )
    db_session.add(token)
    db_session.commit()
    db_session.refresh(token)

    assert token.id is not None
    assert token.created_at is not None
    assert token.used_at is None
    assert token.doctor.email == "token.doctor@example.com"
    assert len(doctor.email_verification_tokens) == 1
    assert doctor.email_verification_tokens[0].id == token.id

    # Cascade delete verification
    db_session.delete(doctor)
    db_session.commit()

    remaining_token = db_session.execute(
        select(EmailVerificationToken).where(EmailVerificationToken.id == token.id)
    ).scalar_one_or_none()
    assert remaining_token is None


def test_alembic_migration_010_upgrade_and_downgrade():
    """Test Alembic migration 010 forward upgrade with backfill and reverse downgrade."""
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db_path = tmp.name
        sqlite_url = f"sqlite:///{db_path}"

        alembic_cfg = Config()
        backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
        alembic_cfg.set_main_option("sqlalchemy.url", sqlite_url)

        # 1. Upgrade to revision 009 (before 010)
        command.upgrade(alembic_cfg, "009_add_working_hours_to_doctor")

        engine = create_engine(sqlite_url)
        with engine.begin() as conn:
            # Insert active and inactive doctors
            active_id = str(uuid.uuid4())
            inactive_id = str(uuid.uuid4())
            conn.execute(
                text(
                    "INSERT INTO doctors (id, email, full_name, auth_provider, is_active, onboarding_completed, created_at, updated_at) "
                    "VALUES (:id, :email, :name, 'google', 1, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ),
                {"id": active_id, "email": "active@example.com", "name": "Active Doc"},
            )
            conn.execute(
                text(
                    "INSERT INTO doctors (id, email, full_name, auth_provider, is_active, onboarding_completed, created_at, updated_at) "
                    "VALUES (:id, :email, :name, 'google', 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ),
                {"id": inactive_id, "email": "inactive@example.com", "name": "Inactive Doc"},
            )

        # 2. Upgrade to 010
        command.upgrade(alembic_cfg, "010_add_email_verification_and_security")

        with engine.begin() as conn:
            active_row = conn.execute(
                text("SELECT email_verified, email_verified_at, failed_login_attempts, locked_until FROM doctors WHERE email = 'active@example.com'")
            ).fetchone()
            assert active_row is not None
            # Active doctor backfilled to verified
            assert active_row[0] in (1, True)
            assert active_row[1] is not None
            assert active_row[2] == 0
            assert active_row[3] is None

            inactive_row = conn.execute(
                text("SELECT email_verified, email_verified_at FROM doctors WHERE email = 'inactive@example.com'")
            ).fetchone()
            assert inactive_row is not None
            # Inactive doctor kept at default (false / 0)
            assert inactive_row[0] in (0, False)
            assert inactive_row[1] is None

            # Verify email_verification_tokens table exists and accepts records
            token_id = str(uuid.uuid4())
            conn.execute(
                text(
                    "INSERT INTO email_verification_tokens (id, doctor_id, token_hash, purpose, expires_at, created_at, updated_at) "
                    "VALUES (:id, :doctor_id, :hash, 'email_verification', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
                ),
                {"id": token_id, "doctor_id": active_id, "hash": "abc" * 20},
            )
            token_count = conn.execute(
                text("SELECT count(*) FROM email_verification_tokens")
            ).scalar()
            assert token_count == 1

        # 3. Test downgrade back to 009
        command.downgrade(alembic_cfg, "009_add_working_hours_to_doctor")

        with engine.begin() as conn:
            # Check table is gone
            table_check = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='email_verification_tokens'")
            ).fetchone()
            assert table_check is None

            # Check columns are gone from doctors
            pragma_info = conn.execute(text("PRAGMA table_info(doctors)")).fetchall()
            col_names = [col[1] for col in pragma_info]
            assert "email_verified" not in col_names
            assert "email_verified_at" not in col_names
            assert "failed_login_attempts" not in col_names
            assert "locked_until" not in col_names
