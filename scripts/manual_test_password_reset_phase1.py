#!/usr/bin/env python3
"""
Manual Automated Test Suite for Password Reset: Phase 1 (Backend Service Layer)

Exercises real runtime flow for AuthService.forgot_password() and AuthService.reset_password()
using SQLite and in-memory email delivery. Tests end-to-end functionality, security controls,
concurrency, timing side-channel mitigation, and error contracts.
"""

import concurrent.futures
import os
import sys
import tempfile
import time
import uuid
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import get_db
from app.core.security import generate_verification_token, hash_password, hash_token, verify_password
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.verification_token import EmailVerificationToken
from app.services.auth_service import auth_service
from app.services.email_service import MemoryEmailBackend, email_service

TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

passed = 0
failed = 0


def log_test(name, success, details=""):
    global passed, failed
    if success:
        passed += 1
        print(f"  ✅ [PASS] {name} {details}")
    else:
        failed += 1
        print(f"  ❌ [FAIL] {name} {details}")


def run_manual_suite():
    global passed, failed
    print("=" * 70)
    print("🚀 LIVE MANUAL AUTOMATED VERIFICATION: PASSWORD RESET PHASE 1")
    print("=" * 70)

    # Initialize memory email backend
    mem_email = MemoryEmailBackend()
    email_service.set_backend(mem_email)

    Base.metadata.create_all(bind=test_engine)
    db = SessionLocal()

    try:
        # -------------------------------------------------------------
        # SCENARIO 1: Happy Path - Forgot Password Flow
        # -------------------------------------------------------------
        print("\n[Scenario 1: Happy Path - Forgot Password]")
        doc = Doctor(
            id=uuid.uuid4(),
            email="dr.smith@clinic.com",
            full_name="Dr. Smith",
            auth_provider="email",
            hashed_password=hash_password("InitialSecure123!"),
            is_active=True,
            email_verified=True,
        )
        db.add(doc)
        db.commit()
        tenant = Tenant(doctor_id=doc.id, slug="dr-smith", status="active")
        db.add(tenant)
        db.commit()

        res1 = auth_service.forgot_password(db, "dr.smith@clinic.com")
        has_msg = "If an account exists with this email" in res1["message"]
        tokens = (
            db.query(EmailVerificationToken)
            .filter(
                EmailVerificationToken.doctor_id == doc.id,
                EmailVerificationToken.purpose == "password_reset",
            )
            .all()
        )
        has_tokens = len(tokens) == 2
        email_sent = len(mem_email.outbox) == 1 and mem_email.outbox[0]["to"] == "dr.smith@clinic.com"
        log_test("1.1 Generic success message returned", has_msg, f"-> '{res1['message']}'")
        log_test("1.2 Two tokens generated (OTP + URL)", has_tokens, f"-> {len(tokens)} token records created")
        log_test("1.3 Email dispatched to inbox", email_sent, f"-> Subject: '{mem_email.outbox[0]['subject']}'")

        # -------------------------------------------------------------
        # SCENARIO 2: Anti-Enumeration & Timing Mitigation
        # -------------------------------------------------------------
        print("\n[Scenario 2: Anti-Enumeration & Side-Channel Mitigation]")
        t0 = time.time()
        res_nonexistent = auth_service.forgot_password(db, "ghost.doctor@clinic.com")
        elapsed_ghost = time.time() - t0

        tokens_ghost = (
            db.query(EmailVerificationToken)
            .join(Doctor, EmailVerificationToken.doctor_id == Doctor.id)
            .filter(Doctor.email == "ghost.doctor@clinic.com")
            .all()
        )
        no_tokens_leaked = len(tokens_ghost) == 0
        same_message = res_nonexistent["message"] == res1["message"]
        # Dummy bcrypt took non-zero time (>= 20ms)
        dummy_bcrypt_burned = elapsed_ghost >= 0.02
        log_test("2.1 Non-existent email yields same response", same_message)
        log_test("2.2 Zero tokens created for non-existent email", no_tokens_leaked)
        log_test("2.3 Dummy bcrypt timing side-channel neutralized", dummy_bcrypt_burned, f"-> {elapsed_ghost*1000:.1f}ms")

        # Inactive doctor
        doc_inactive = Doctor(
            id=uuid.uuid4(),
            email="inactive.doc@clinic.com",
            full_name="Dr. Inactive",
            auth_provider="email",
            hashed_password=hash_password("Pass12345!"),
            is_active=False,
            email_verified=True,
        )
        db.add(doc_inactive)
        db.commit()
        res_inactive = auth_service.forgot_password(db, "inactive.doc@clinic.com")
        log_test("2.4 Inactive doctor account status not leaked", res_inactive["message"] == res1["message"])

        # -------------------------------------------------------------
        # SCENARIO 3: Domain-Level 60s Cooldown Rate Limiting
        # -------------------------------------------------------------
        print("\n[Scenario 3: Domain-Level 60-Second Cooldown]")
        try:
            auth_service.forgot_password(db, "dr.smith@clinic.com")
            log_test("3.1 Rapid repeat request rejected", False, "Expected HTTP 429")
        except HTTPException as e:
            is_429 = e.status_code == 429
            retry_after = e.headers.get("Retry-After")
            has_retry = retry_after is not None and int(retry_after) > 0
            log_test("3.1 Rapid repeat request rejected with HTTP 429", is_429, f"-> Code {e.status_code}")
            log_test("3.2 Structured Retry-After header present", has_retry, f"-> Retry-After: {retry_after}s")

        # -------------------------------------------------------------
        # SCENARIO 4: Google-Only Account Password Reset
        # -------------------------------------------------------------
        print("\n[Scenario 4: Google-Only Account Enabling Password Login]")
        doc_google = Doctor(
            id=uuid.uuid4(),
            email="google.doc@clinic.com",
            full_name="Dr. Google User",
            auth_provider="google",
            hashed_password=None,
            is_active=True,
            email_verified=True,
        )
        db.add(doc_google)
        db.commit()
        tenant_google = Tenant(doctor_id=doc_google.id, slug="dr-google-user", status="active")
        db.add(tenant_google)
        db.commit()

        mem_email.clear()
        res_goog = auth_service.forgot_password(db, "google.doc@clinic.com")
        log_test("4.1 Google account successfully requests reset", len(mem_email.outbox) == 1)

        # -------------------------------------------------------------
        # SCENARIO 5: Reset Password with OTP + Auto Login
        # -------------------------------------------------------------
        print("\n[Scenario 5: Reset Password with 6-Digit OTP]")
        otp, token = generate_verification_token()
        now = datetime.now(timezone.utc)
        db.add(
            EmailVerificationToken(
                doctor_id=doc.id,
                token_hash=hash_token(otp),
                purpose="password_reset",
                expires_at=now + timedelta(minutes=30),
                sent_at=now,
            )
        )
        db.commit()

        reset_res = auth_service.reset_password(
            db=db,
            raw_code_or_token=otp,
            email="dr.smith@clinic.com",
            new_password="NewSecurePassword2026!",
        )
        db.refresh(doc)
        pw_updated = verify_password("NewSecurePassword2026!", doc.hashed_password)
        jwt_issued = bool(reset_res.access_token)
        log_test("5.1 New password hashed and persisted", pw_updated)
        log_test("5.2 Auto-login JWT token issued", jwt_issued, f"-> Bearer {reset_res.access_token[:20]}...")

        # Verify /me endpoint works with returned JWT
        def override_db():
            yield db

        app.dependency_overrides[get_db] = override_db
        with TestClient(app) as client:
            me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {reset_res.access_token}"})
            me_ok = me_resp.status_code == 200 and me_resp.json()["email"] == "dr.smith@clinic.com"
            log_test("5.3 Authenticated /me endpoint accessible with JWT", me_ok, f"-> Status {me_resp.status_code}")
        app.dependency_overrides.clear()

        # -------------------------------------------------------------
        # SCENARIO 6: Single-Use Replay Protection
        # -------------------------------------------------------------
        print("\n[Scenario 6: Replay Protection]")
        try:
            auth_service.reset_password(
                db=db,
                raw_code_or_token=otp,
                email="dr.smith@clinic.com",
                new_password="AnotherPassword2026!",
            )
            log_test("6.1 Replay attack rejected", False, "Replay unexpectedly succeeded")
        except HTTPException as e:
            is_replay_err = e.status_code == 400 and "already been used" in e.detail.lower()
            log_test("6.1 Replay attack rejected with HTTP 400", is_replay_err, f"-> '{e.detail}'")

        # -------------------------------------------------------------
        # SCENARIO 7: Reset via URL Token (Magic Link - Email Omitted)
        # -------------------------------------------------------------
        print("\n[Scenario 7: URL Token (Magic Link without Email Parameter)]")
        otp2, token2 = generate_verification_token()
        db.add(
            EmailVerificationToken(
                doctor_id=doc.id,
                token_hash=hash_token(token2),
                purpose="password_reset",
                expires_at=now + timedelta(minutes=30),
                sent_at=now,
            )
        )
        db.commit()

        url_res = auth_service.reset_password(
            db=db,
            raw_code_or_token=token2,
            new_password="MagicLinkPassword2026!",
        )
        db.refresh(doc)
        magic_ok = verify_password("MagicLinkPassword2026!", doc.hashed_password)
        log_test("7.1 Magic link token resets password without email param", magic_ok)

        # -------------------------------------------------------------
        # SCENARIO 8: Expired Token Rejection
        # -------------------------------------------------------------
        print("\n[Scenario 8: Expired Token Handling]")
        otp_exp, _ = generate_verification_token()
        db.add(
            EmailVerificationToken(
                doctor_id=doc.id,
                token_hash=hash_token(otp_exp),
                purpose="password_reset",
                expires_at=now - timedelta(minutes=1),  # Expired 1 min ago
                sent_at=now - timedelta(minutes=31),
            )
        )
        db.commit()

        try:
            auth_service.reset_password(
                db=db,
                raw_code_or_token=otp_exp,
                email="dr.smith@clinic.com",
                new_password="ExpiredTestPassword2026!",
            )
            log_test("8.1 Expired token rejected", False)
        except HTTPException as e:
            is_expired = e.status_code == 400 and "expired" in e.detail.lower()
            log_test("8.1 Expired token rejected with HTTP 400", is_expired, f"-> '{e.detail}'")

        # -------------------------------------------------------------
        # SCENARIO 9: Brute-Force Rate Limiting & Auto-Invalidation
        # -------------------------------------------------------------
        print("\n[Scenario 9: Brute-Force Guessing & Token Invalidation]")
        otp_bf, _ = generate_verification_token()
        bf_token_rec = EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp_bf),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
        db.add(bf_token_rec)
        db.commit()

        doc.failed_login_attempts = 0
        db.commit()

        for attempt in range(4):
            try:
                auth_service.reset_password(
                    db=db,
                    raw_code_or_token=f"99990{attempt}",
                    email="dr.smith@clinic.com",
                    new_password="BruteForcePassword2026!",
                )
            except HTTPException:
                pass

        db.refresh(doc)
        log_test("9.1 Failed attempts counter incremented to 4", doc.failed_login_attempts == 4)
        db.refresh(bf_token_rec)
        log_test("9.2 Token remains active prior to 5th attempt", bf_token_rec.used_at is None)

        try:
            auth_service.reset_password(
                db=db,
                raw_code_or_token="999904",
                email="dr.smith@clinic.com",
                new_password="BruteForcePassword2026!",
            )
            log_test("9.3 5th failed attempt invalidates all reset tokens", False)
        except HTTPException as e:
            db.refresh(bf_token_rec)
            invalidated = bf_token_rec.used_at is not None
            is_locked_err = "too many failed" in e.detail.lower()
            log_test("9.3 5th failed attempt invalidates all reset tokens", invalidated and is_locked_err, f"-> '{e.detail}'")

        # -------------------------------------------------------------
        # SCENARIO 10: Reject Same Password Reuse
        # -------------------------------------------------------------
        print("\n[Scenario 10: Reject Same Password as Current]")
        otp_same, _ = generate_verification_token()
        db.add(
            EmailVerificationToken(
                doctor_id=doc.id,
                token_hash=hash_token(otp_same),
                purpose="password_reset",
                expires_at=now + timedelta(minutes=30),
                sent_at=now,
            )
        )
        db.commit()

        try:
            auth_service.reset_password(
                db=db,
                raw_code_or_token=otp_same,
                email="dr.smith@clinic.com",
                new_password="MagicLinkPassword2026!",  # Current password from Scenario 7
            )
            log_test("10.1 Same password rejected", False)
        except HTTPException as e:
            is_same_err = e.status_code == 400 and "different from the current password" in e.detail.lower()
            log_test("10.1 Same password rejected with HTTP 400", is_same_err, f"-> '{e.detail}'")

        # -------------------------------------------------------------
        # SCENARIO 11: Clear Lockout on Successful Reset
        # -------------------------------------------------------------
        print("\n[Scenario 11: Clear Lockout & Attempts Counter on Reset]")
        doc.failed_login_attempts = 5
        doc.locked_until = now + timedelta(minutes=15)
        db.commit()

        auth_service.reset_password(
            db=db,
            raw_code_or_token=otp_same,
            email="dr.smith@clinic.com",
            new_password="RecoveredPassword2026!",
        )
        db.refresh(doc)
        log_test("11.1 failed_login_attempts reset to 0", doc.failed_login_attempts == 0)
        log_test("11.2 locked_until reset to None", doc.locked_until is None)

        # -------------------------------------------------------------
        # SCENARIO 12: Isolation from Email Verification Tokens
        # -------------------------------------------------------------
        print("\n[Scenario 12: Isolation from Email Verification Tokens]")
        ev_token = EmailVerificationToken(
            doctor_id=doc.id,
            token_hash="hash_email_verif_123",
            purpose="email_verification",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
        otp_iso, _ = generate_verification_token()
        pr_token = EmailVerificationToken(
            doctor_id=doc.id,
            token_hash=hash_token(otp_iso),
            purpose="password_reset",
            expires_at=now + timedelta(minutes=30),
            sent_at=now,
        )
        db.add_all([ev_token, pr_token])
        db.commit()

        auth_service.reset_password(
            db=db,
            raw_code_or_token=otp_iso,
            email="dr.smith@clinic.com",
            new_password="IsolationCheckPassword2026!",
        )
        db.refresh(ev_token)
        db.refresh(pr_token)
        log_test("12.1 Reset token marked used", pr_token.used_at is not None)
        log_test("12.2 Email verification token left untouched (used_at IS NULL)", ev_token.used_at is None)

        # -------------------------------------------------------------
        # SCENARIO 13: Atomic CAS Concurrency Test Across Threads
        # -------------------------------------------------------------
        print("\n[Scenario 13: High-Concurrency Atomic CAS Replay Defense]")
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            temp_db_path = f.name

        try:
            concur_engine = create_engine(f"sqlite:///{temp_db_path}", connect_args={"timeout": 15})
            Base.metadata.create_all(bind=concur_engine)
            ConcurSession = sessionmaker(autocommit=False, autoflush=False, bind=concur_engine)

            c_db = ConcurSession()
            c_doc = Doctor(
                id=uuid.uuid4(),
                email="concurrent.runner@clinic.com",
                full_name="Dr. Concurrency",
                auth_provider="email",
                hashed_password=hash_password("OldPassword123!"),
                is_active=True,
                email_verified=True,
            )
            c_db.add(c_doc)
            c_db.commit()
            c_tenant = Tenant(doctor_id=c_doc.id, slug="dr-concurrency", status="active")
            c_db.add(c_tenant)

            c_otp, _ = generate_verification_token()
            c_token = EmailVerificationToken(
                doctor_id=c_doc.id,
                token_hash=hash_token(c_otp),
                purpose="password_reset",
                expires_at=now + timedelta(minutes=30),
                sent_at=now,
            )
            c_db.add(c_token)
            c_db.commit()
            c_db.close()

            def attempt_reset():
                thread_session = ConcurSession()
                try:
                    r = auth_service.reset_password(
                        db=thread_session,
                        raw_code_or_token=c_otp,
                        email="concurrent.runner@clinic.com",
                        new_password="RaceProofPassword2026!",
                    )
                    return {"status": 200, "token": r.access_token}
                except HTTPException as exc:
                    return {"status": exc.status_code, "detail": exc.detail}
                finally:
                    thread_session.close()

            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
                f1 = executor.submit(attempt_reset)
                f2 = executor.submit(attempt_reset)
                results = [f1.result(), f2.result()]

            statuses = [r["status"] for r in results]
            concur_ok = 200 in statuses and 400 in statuses
            log_test("13.1 Exactly one thread succeeds (200), competing thread gets 400 replay error", concur_ok, f"-> Statuses: {statuses}")
        finally:
            if os.path.exists(temp_db_path):
                os.remove(temp_db_path)

        # -------------------------------------------------------------
        # SCENARIO 14: Email Delivery Failure (Atomic Rollback)
        # -------------------------------------------------------------
        print("\n[Scenario 14: Email Outage & Atomic Rollback Handling]")
        doc_outage = Doctor(
            id=uuid.uuid4(),
            email="dr.outage@clinic.com",
            full_name="Dr. Outage",
            auth_provider="email",
            hashed_password=hash_password("Outage123!"),
            is_active=True,
            email_verified=True,
        )
        db.add(doc_outage)
        db.commit()

        class OutageBackend:
            def send(self, *args, **kwargs):
                return False

        email_service.set_backend(OutageBackend())
        try:
            auth_service.forgot_password(db, "dr.outage@clinic.com")
            log_test("14.1 Provider failure raises HTTP 503", False)
        except HTTPException as e:
            is_503 = e.status_code == 503
            log_test("14.1 Provider failure raises HTTP 503", is_503, f"-> Code {e.status_code}: '{e.detail}'")

            # Verify no tokens leaked into DB
            outage_tokens = (
                db.query(EmailVerificationToken)
                .filter(EmailVerificationToken.doctor_id == doc_outage.id)
                .all()
            )
            log_test("14.2 Atomic rollback: zero tokens committed to DB on delivery error", len(outage_tokens) == 0)

        email_service.set_backend(mem_email)

    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)

    print("\n" + "=" * 70)
    print(f"📊 LIVE VERIFICATION SUMMARY: {passed} PASSED | {failed} FAILED")
    print("=" * 70)
    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    run_manual_suite()
