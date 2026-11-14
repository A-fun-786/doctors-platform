#!/usr/bin/env python3
"""
Manual Automated Test Suite for Password Reset: Phase 2 (Config, Schemas, Routes)

Exercises real runtime flow for POST /api/v1/auth/forgot-password and
POST /api/v1/auth/reset-password endpoints using TestClient against live FastAPI app.
Tests HTTP contracts, schemas, SlowAPI rate limiting, domain cooldown, and end-to-end flows.
"""

import os
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.config import get_settings
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import generate_verification_token, hash_password, hash_token, verify_password
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.verification_token import EmailVerificationToken
from app.services.email_service import MemoryEmailBackend, email_service

settings = get_settings()

TEST_DATABASE_URL = 'sqlite:///:memory:'
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={'check_same_thread': False},
    poolclass=StaticPool,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

passed = 0
failed = 0


def log_test(name, success, details=''):
    global passed, failed
    if success:
        passed += 1
        print(f'  ✅ [PASS] {name} {details}')
    else:
        failed += 1
        print(f'  ❌ [FAIL] {name} {details}')


def reset_db_and_mem():
    Base.metadata.drop_all(bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    mem = MemoryEmailBackend()
    email_service.set_backend(mem)
    limiter.reset()
    return mem


def override_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_db


def create_doctor(db, email='doctor.phase2@example.com', password='InitialPassword123!', is_active=True, email_verified=True, slug=None):
    doc = Doctor(
        id=uuid.uuid4(),
        email=email,
        full_name='Dr. Phase 2 Tester',
        auth_provider='email',
        hashed_password=hash_password(password) if password else None,
        is_active=is_active,
        email_verified=email_verified,
        failed_login_attempts=0,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    tenant = Tenant(
        doctor_id=doc.id,
        slug=slug or f'dr-phase2-{uuid.uuid4().hex[:8]}',
        status='active',
    )
    db.add(tenant)
    db.commit()
    db.refresh(doc)
    return doc


def run_phase2_suite():
    global passed, failed
    print('========================================================================')
    print('  LIVE MANUAL AUTOMATED TEST SUITE: PASSWORD RESET PHASE 2 (ROUTES & SCHEMAS)')
    print('========================================================================\n')

    client = TestClient(app)

    # --- Scenario 1: POST /forgot-password Happy Path ---
    print('Scenario 1: POST /api/v1/auth/forgot-password Happy Path')
    mem = reset_db_and_mem()
    db = SessionLocal()
    doc = create_doctor(db, 'doc.happy@example.com')
    db.close()

    res = client.post('/api/v1/auth/forgot-password', json={'email': 'doc.happy@example.com'})
    log_test('1.1 Status code 200 OK', res.status_code == 200, f'Status: {res.status_code}')
    data = res.json()
    log_test('1.2 Response body contract', data.get('message') == 'If an account exists with this email, a password reset link has been sent.', f'Message: {data.get("message")}')
    log_test('1.3 Email dispatched to outbox', len(mem.outbox) == 1 and mem.outbox[0]['to'] == 'doc.happy@example.com')
    
    db = SessionLocal()
    tokens = db.query(EmailVerificationToken).filter_by(purpose='password_reset').all()
    log_test('1.4 Two tokens (OTP + URL token) in DB', len(tokens) == 2 and all(t.sent_at is not None for t in tokens))
    db.close()

    # --- Scenario 2: Anti-Enumeration & Timing Protection ---
    print('\nScenario 2: Anti-Enumeration & Side-Channel Mitigation')
    mem = reset_db_and_mem()
    t0 = time.perf_counter()
    res = client.post('/api/v1/auth/forgot-password', json={'email': 'nonexistent@example.com'})
    t_elapsed = (time.perf_counter() - t0) * 1000
    log_test('2.1 Status 200 on non-existent account', res.status_code == 200)
    log_test('2.2 Generic message matches exactly', res.json().get('message') == 'If an account exists with this email, a password reset link has been sent.')
    log_test('2.3 Dummy bcrypt timing side-channel burned', t_elapsed >= 20, f'Elapsed: {t_elapsed:.1f}ms')
    log_test('2.4 Zero emails sent on non-existent account', len(mem.outbox) == 0)

    # Inactive doctor
    db = SessionLocal()
    doc_inact = create_doctor(db, 'inactive@example.com', is_active=False)
    db.close()
    res_inact = client.post('/api/v1/auth/forgot-password', json={'email': 'inactive@example.com'})
    log_test('2.5 Inactive doctor status unrevealed (200 generic)', res_inact.status_code == 200 and len(mem.outbox) == 0)

    # --- Scenario 3: Request Validation & Error Contracts (422) ---
    print('\nScenario 3: Input Validation (422 Unprocessable Content)')
    res_bad_email = client.post('/api/v1/auth/forgot-password', json={'email': 'not-an-email'})
    log_test('3.1 Invalid email format rejected with 422', res_bad_email.status_code == 422)

    res_empty = client.post('/api/v1/auth/forgot-password', json={})
    log_test('3.2 Missing email field rejected with 422', res_empty.status_code == 422)

    # --- Scenario 4: Domain-Level 60s Cooldown ---
    print('\nScenario 4: Domain-Level Cooldown (HTTP 429)')
    mem = reset_db_and_mem()
    db = SessionLocal()
    doc = create_doctor(db, 'doc.cooldown@example.com')
    db.close()

    r1 = client.post('/api/v1/auth/forgot-password', json={'email': 'doc.cooldown@example.com'})
    log_test('4.1 First request succeeds', r1.status_code == 200)

    r2 = client.post('/api/v1/auth/forgot-password', json={'email': 'doc.cooldown@example.com'})
    log_test('4.2 Second request within 60s triggers 429', r2.status_code == 429)
    log_test('4.3 Retry-After header present and positive', 'Retry-After' in r2.headers and int(r2.headers['Retry-After']) > 0, f'Retry-After: {r2.headers.get("Retry-After")}s')

    # --- Scenario 5: SlowAPI Route-Level Rate Limiting (3/minute) ---
    print('\nScenario 5: SlowAPI Route Rate Limiting (3/min)')
    mem = reset_db_and_mem()
    db = SessionLocal()
    for i in range(3):
        create_doctor(db, f'doc{i}@example.com')
    db.close()

    for i in range(3):
        res = client.post('/api/v1/auth/forgot-password', json={'email': f'doc{i}@example.com'})
        assert res.status_code == 200

    res_limit = client.post('/api/v1/auth/forgot-password', json={'email': 'doc_extra@example.com'})
    log_test('5.1 4th request from same IP blocked by SlowAPI 429', res_limit.status_code == 429)

    # --- Scenario 6: POST /reset-password with OTP ---
    print('\nScenario 6: POST /api/v1/auth/reset-password with OTP')
    mem = reset_db_and_mem()
    db = SessionLocal()
    doc = create_doctor(db, 'doc.reset_otp@example.com', password='OldPassword123!')
    otp, token = generate_verification_token()
    now = datetime.now(timezone.utc)
    db.add(EmailVerificationToken(
        doctor_id=doc.id,
        token_hash=hash_token(otp),
        purpose='password_reset',
        expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
        sent_at=now,
    ))
    db.commit()
    db.close()

    reset_res = client.post('/api/v1/auth/reset-password', json={
        'email': 'doc.reset_otp@example.com',
        'code': otp,
        'new_password': 'BrandNewPassword2026!',
    })
    log_test('6.1 Reset succeeds with HTTP 200', reset_res.status_code == 200)
    data = reset_res.json()
    jwt_token = data.get('access_token')
    log_test('6.2 Returns access_token in AuthResponse', bool(jwt_token))
    log_test('6.3 Returns doctor and tenant objects', data.get('doctor', {}).get('email') == 'doc.reset_otp@example.com' and 'tenant' in data)

    # Test authenticated /me with issued JWT
    me_res = client.get('/api/v1/auth/me', headers={'Authorization': f'Bearer {jwt_token}'})
    log_test('6.4 Issued JWT is valid on GET /api/v1/auth/me', me_res.status_code == 200)

    # Test login with new password
    login_res = client.post('/api/v1/auth/login', json={
        'email': 'doc.reset_otp@example.com',
        'password': 'BrandNewPassword2026!',
    })
    log_test('6.5 Login succeeds with newly updated password', login_res.status_code == 200)

    # --- Scenario 7: POST /reset-password with URL Token (No Email) ---
    print('\nScenario 7: POST /api/v1/auth/reset-password with URL Token (No Email)')
    mem = reset_db_and_mem()
    db = SessionLocal()
    doc = create_doctor(db, 'doc.magic@example.com')
    otp, token = generate_verification_token()
    now = datetime.now(timezone.utc)
    db.add(EmailVerificationToken(
        doctor_id=doc.id,
        token_hash=hash_token(token),
        purpose='password_reset',
        expires_at=now + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES),
        sent_at=now,
    ))
    db.commit()
    db.close()

    magic_res = client.post('/api/v1/auth/reset-password', json={
        'token': token,
        'new_password': 'BrandNewPassword2026!',
    })
    log_test('7.1 Magic link token reset succeeds without email', magic_res.status_code == 200 and 'access_token' in magic_res.json())

    # --- Scenario 8: Schema Validation on /reset-password ---
    print('\nScenario 8: Reset Password Schema Validation')
    res_no_code_or_token = client.post('/api/v1/auth/reset-password', json={
        'email': 'doc@example.com',
        'new_password': 'BrandNewPassword2026!',
    })
    log_test('8.1 Missing both code and token returns 422', res_no_code_or_token.status_code == 422 and 'Either code or token is required' in res_no_code_or_token.text)

    # --- Scenario 9: Replay Defense on Endpoint ---
    print('\nScenario 9: Token Replay Defense')
    replay_res = client.post('/api/v1/auth/reset-password', json={
        'token': token,
        'new_password': 'AnotherPassword2026!',
    })
    log_test('9.1 Reused token rejected with HTTP 400', replay_res.status_code == 400 and 'already been used' in replay_res.json().get('detail', '').lower())

    # --- Scenario 10: Expired Token Rejection ---
    print('\nScenario 10: Expired Token Rejection')
    mem = reset_db_and_mem()
    db = SessionLocal()
    doc = create_doctor(db, 'doc.expired@example.com')
    otp, _ = generate_verification_token()
    past = datetime.now(timezone.utc) - timedelta(minutes=10)
    db.add(EmailVerificationToken(
        doctor_id=doc.id,
        token_hash=hash_token(otp),
        purpose='password_reset',
        expires_at=past,
        sent_at=past,
    ))
    db.commit()
    db.close()

    exp_res = client.post('/api/v1/auth/reset-password', json={
        'email': 'doc.expired@example.com',
        'code': otp,
        'new_password': 'BrandNewPassword2026!',
    })
    log_test('10.1 Expired token rejected with HTTP 400', exp_res.status_code == 400 and 'expired' in exp_res.json().get('detail', '').lower())

    # --- Scenario 11: Weak Password Policy Enforcement ---
    print('\nScenario 11: Weak Password Policy Enforcement')
    mem = reset_db_and_mem()
    db = SessionLocal()
    doc = create_doctor(db, 'doc.weak@example.com')
    otp, _ = generate_verification_token()
    now = datetime.now(timezone.utc)
    db.add(EmailVerificationToken(
        doctor_id=doc.id,
        token_hash=hash_token(otp),
        purpose='password_reset',
        expires_at=now + timedelta(minutes=30),
        sent_at=now,
    ))
    db.commit()
    db.close()

    weak_res = client.post('/api/v1/auth/reset-password', json={
        'email': 'doc.weak@example.com',
        'code': otp,
        'new_password': 'weak',
    })
    log_test('11.1 Weak password rejected with HTTP 400', weak_res.status_code == 400 and 'at least 8 characters' in weak_res.json().get('detail', '').lower())

    # --- Scenario 12: Same as Current Password Rejection ---
    print('\nScenario 12: Same Password Rejection')
    same_pw = 'CurrentSecret999!'
    mem = reset_db_and_mem()
    db = SessionLocal()
    doc = create_doctor(db, 'doc.identical@example.com', password=same_pw)
    otp, _ = generate_verification_token()
    now = datetime.now(timezone.utc)
    db.add(EmailVerificationToken(
        doctor_id=doc.id,
        token_hash=hash_token(otp),
        purpose='password_reset',
        expires_at=now + timedelta(minutes=30),
        sent_at=now,
    ))
    db.commit()
    db.close()

    same_res = client.post('/api/v1/auth/reset-password', json={
        'email': 'doc.identical@example.com',
        'code': otp,
        'new_password': same_pw,
    })
    log_test('12.1 Same password rejected with HTTP 400', same_res.status_code == 400 and 'different from the current password' in same_res.json().get('detail', '').lower())

    # --- Scenario 13: Brute-Force Guessing on Endpoint ---
    print('\nScenario 13: Brute-Force Guessing on Endpoint')
    mem = reset_db_and_mem()
    db = SessionLocal()
    doc = create_doctor(db, 'doc.bf@example.com')
    otp, _ = generate_verification_token()
    now = datetime.now(timezone.utc)
    token_row = EmailVerificationToken(
        doctor_id=doc.id,
        token_hash=hash_token(otp),
        purpose='password_reset',
        expires_at=now + timedelta(minutes=30),
        sent_at=now,
    )
    db.add(token_row)
    db.commit()
    token_id = token_row.id
    db.close()

    # 4 failed attempts (reset IP limiter to test account-level 5-attempt counter under distributed requests)
    for i in range(4):
        limiter.reset()
        r = client.post('/api/v1/auth/reset-password', json={
            'email': 'doc.bf@example.com',
            'code': f'00000{i}',
            'new_password': 'BrandNewPassword2026!',
        })
        assert r.status_code == 400

    db = SessionLocal()
    t_check = db.query(EmailVerificationToken).filter_by(id=token_id).first()
    log_test('13.1 Token remains valid after 4 failed attempts', t_check.used_at is None)
    db.close()

    # 5th failed attempt -> lockout invalidation
    limiter.reset()
    r5 = client.post('/api/v1/auth/reset-password', json={
        'email': 'doc.bf@example.com',
        'code': '000004',
        'new_password': 'BrandNewPassword2026!',
    })
    log_test('13.2 5th attempt triggers lockout error', r5.status_code == 400 and 'too many failed' in r5.json().get('detail', '').lower())

    db = SessionLocal()
    t_check = db.query(EmailVerificationToken).filter_by(id=token_id).first()
    log_test('13.3 All reset tokens invalidated on 5th failure', t_check.used_at is not None)
    db.close()

    # --- Scenario 14: SlowAPI Route Limit on /reset-password ---
    print('\nScenario 14: SlowAPI Limit on /reset-password')
    limiter.reset()
    for i in range(3):
        r = client.post('/api/v1/auth/reset-password', json={
            'email': f'doc{i}@example.com',
            'code': '000000',
            'new_password': 'BrandNewPassword2026!',
        })
        assert r.status_code == 400

    r4 = client.post('/api/v1/auth/reset-password', json={
        'email': 'doc_extra@example.com',
        'code': '000000',
        'new_password': 'BrandNewPassword2026!',
    })
    log_test('14.1 4th reset request from same IP hits SlowAPI 429', r4.status_code == 429)

    print('\n========================================================================')
    print(f'  RESULTS: {passed} passed, {failed} failed')
    print('========================================================================')
    return failed == 0


if __name__ == '__main__':
    success = run_phase2_suite()
    sys.exit(0 if success else 1)
