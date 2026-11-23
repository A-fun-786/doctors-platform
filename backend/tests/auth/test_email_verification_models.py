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
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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


def test_alembic_migration_012_upgrade_and_downgrade():
    """Test Alembic migration 012 forward upgrade adding reset index and reverse downgrade."""
    with tempfile.NamedTemporaryFile(suffix=".db") as tmp:
        db_path = tmp.name
        sqlite_url = f"sqlite:///{db_path}"

        alembic_cfg = Config()
        backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
        alembic_cfg.set_main_option("sqlalchemy.url", sqlite_url)

        # 1. Upgrade to revision 011 (before 012)
        command.upgrade(alembic_cfg, "011_add_sent_at_to_verification_tokens")

        engine = create_engine(sqlite_url)
        with engine.begin() as conn:
            # Check 012 index does NOT exist yet
            index_check = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='index' AND name='ix_evt_doctor_purpose_reset'")
            ).fetchone()
            assert index_check is None

        # 2. Upgrade to 012
        command.upgrade(alembic_cfg, "012_add_password_reset_purpose_support")

        with engine.begin() as conn:
            # Check 012 index exists and has partial WHERE clause
            index_row = conn.execute(
                text("SELECT name, sql FROM sqlite_master WHERE type='index' AND name='ix_evt_doctor_purpose_reset'")
            ).fetchone()
            assert index_row is not None
            assert "ix_evt_doctor_purpose_reset" == index_row[0]
            assert "password_reset" in (index_row[1] or "")

        # 3. Test downgrade back to 011
        command.downgrade(alembic_cfg, "011_add_sent_at_to_verification_tokens")

        with engine.begin() as conn:
            # Check index is dropped
            index_check_after_downgrade = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='index' AND name='ix_evt_doctor_purpose_reset'")
            ).fetchone()
            assert index_check_after_downgrade is None

            # Table still exists
            tbl_check = conn.execute(
                text("SELECT name FROM sqlite_master WHERE type='table' AND name='email_verification_tokens'")
            ).fetchone()
            assert tbl_check is not None

        # 4. Upgrade to 013_add_token_version_to_doctors and verify token_version column
        command.upgrade(alembic_cfg, "013_add_token_version_to_doctors")
        with engine.begin() as conn:
            cols = [
                row[1]
                for row in conn.execute(text("PRAGMA table_info(doctors)")).fetchall()
            ]
            assert "token_version" in cols


def test_login_lockout_google_unverified_and_token_revocation(client, db_session):
    """Verify Phase 3 auth hardening: password login lockout, Google email_verified check, and JWT revocation on password reset."""
    from unittest.mock import patch
    from app.core.security import generate_verification_token, hash_password, hash_token
    from datetime import datetime, timedelta, timezone

    # 1. Google OAuth rejects unverified email
    with patch(
        "app.services.auth_service.verify_google_token",
        return_value={
            "email": "unverified.google@hospital.org",
            "name": "Dr. Unverified",
            "sub": "unverified-sub-1",
            "picture": None,
            "email_verified": False,
        },
    ):
        g_res = client.post("/api/v1/auth/google", json={"credential": "mock-unverified-token"})
        assert g_res.status_code == 400
        assert "not verified" in g_res.json()["detail"].lower()

    # 2. Password login brute-force lockout after 5 failed attempts
    doc = Doctor(
        email="lockout.test@hospital.org",
        full_name="Dr. Lockout",
        auth_provider="email",
        hashed_password=hash_password("CorrectHorseBattery1!"),
        is_active=True,
        email_verified=True,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)

    for _ in range(5):
        fail_res = client.post(
            "/api/v1/auth/login",
            json={"email": "lockout.test@hospital.org", "password": "WrongPassword123!"},
        )
        assert fail_res.status_code == 401

    # Simulate distributed IP rotation (reset IP rate limiter) — account lockout still blocks with 403
    from app.core.rate_limit import limiter
    limiter.reset()

    locked_res = client.post(
        "/api/v1/auth/login",
        json={"email": "lockout.test@hospital.org", "password": "CorrectHorseBattery1!"},
    )
    assert locked_res.status_code == 403
    assert "locked" in locked_res.json()["detail"].lower()

    # Clear lock and login to get valid JWT (token_version = 1)
    doc.locked_until = None
    doc.failed_login_attempts = 0
    db_session.commit()

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "lockout.test@hospital.org", "password": "CorrectHorseBattery1!"},
    )
    assert login_res.status_code == 200
    old_jwt = login_res.json()["access_token"]

    me_before = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_jwt}"})
    assert me_before.status_code == 200

    # 3. Password reset increments token_version and immediately revokes old_jwt
    otp, _ = generate_verification_token()
    reset_tok = EmailVerificationToken(
        doctor_id=doc.id,
        token_hash=hash_token(otp),
        purpose="password_reset",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=30),
    )
    db_session.add(reset_tok)
    db_session.commit()

    reset_res = client.post(
        "/api/v1/auth/reset-password",
        json={
            "email": "lockout.test@hospital.org",
            "code": otp,
            "new_password": "BrandNewSecurePassword2!",
        },
    )
    assert reset_res.status_code == 200
    new_jwt = reset_res.json()["access_token"]

    # Old JWT must now fail with 401 Unauthorized
    me_old = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {old_jwt}"})
    assert me_old.status_code == 401

    # New JWT succeeds
    me_new = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_jwt}"})
    assert me_new.status_code == 200
