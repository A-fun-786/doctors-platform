import re
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.security import (
    verify_google_token,
    create_access_token,
    hash_password,
    verify_password,
    needs_rehash,
    DUMMY_BCRYPT_HASH,
    generate_verification_token,
    hash_token,
    verify_token_hash,
)
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.verification_token import EmailVerificationToken
from app.schemas.auth import (
    AuthResponse,
    DoctorResponse,
    TenantResponse,
    validate_email_id,
    validate_password_strength,
    sanitize_full_name,
    sanitize_phone,
)
from app.services.email_service import email_service

settings = get_settings()
logger = get_logger("auth_service")


def slugify(text: str) -> str:
    """Generate a URL-friendly slug from text."""
    # Convert to lowercase and replace accents/special characters
    text = text.lower().strip()
    # Replace non-alphanumeric characters with hyphens
    text = re.sub(r"[^\w\s-]", "", text)
    # Replace whitespace and repeated hyphens with a single hyphen
    text = re.sub(r"[-\s]+", "-", text)
    # Strip leading and trailing hyphens
    slug = text.strip("-")
    return slug or "doctor"


def generate_unique_tenant_slug(db: Session, full_name: str) -> str:
    """
    Generate a unique tenant slug deterministically based on doctor's name.
    Example: 'Dr. Ahmed Khan' -> 'dr-ahmed-khan'
    Collision handling: 'dr-ahmed-khan' -> 'dr-ahmed-khan-2' -> 'dr-ahmed-khan-3'
    """
    base_slug = slugify(full_name)
    slug = base_slug
    counter = 2

    while db.query(Tenant).filter(Tenant.slug == slug).first() is not None:
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


class AuthService:
    """
    Authentication Service managing doctor registration and multi-provider sign-ins.
    Designed to easily support additional providers (email/pass, Apple, etc.) in future phases.
    """

    @staticmethod
    def authenticate_google(db: Session, credential: str) -> AuthResponse:
        """
        Authenticate or register a doctor via Google ID Token.
        Atomically provisions Doctor and Tenant records on initial registration.
        """
        try:
            id_info = verify_google_token(credential)
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Google authentication token: {str(e)}",
            )

        email = id_info.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google account does not have an associated email address",
            )
            
        email = email.lower().strip()
        full_name = id_info.get("name") or email.split("@")[0].capitalize()
        provider_id = id_info.get("sub")
        avatar_url = id_info.get("picture")

        # Find existing doctor by email
        doctor = db.query(Doctor).filter(Doctor.email == email).first()

        if doctor:
            # Check account active
            if not doctor.is_active:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Inactive user account",
                )
            
            # Update provider info if missing and mark verified via Google
            updated = False
            if not doctor.provider_id and provider_id:
                doctor.provider_id = provider_id
                updated = True
            if avatar_url and doctor.avatar_url != avatar_url:
                doctor.avatar_url = avatar_url
                updated = True
            if not doctor.email_verified:
                doctor.email_verified = True
                doctor.email_verified_at = datetime.now(timezone.utc)
                updated = True
            if updated:
                db.commit()
                db.refresh(doctor)

            tenant = doctor.tenant
            if not tenant:
                # In case a doctor somehow exists without a tenant, create one atomically
                slug = generate_unique_tenant_slug(db, doctor.full_name)
                tenant = Tenant(doctor_id=doctor.id, slug=slug, status="active")
                db.add(tenant)
                db.commit()
                db.refresh(tenant)
        else:
            # Atomic creation of Doctor and Tenant
            try:
                doctor = Doctor(
                    email=email,
                    full_name=full_name,
                    avatar_url=avatar_url,
                    auth_provider="google",
                    provider_id=provider_id,
                    is_active=True,
                    email_verified=True,
                    email_verified_at=datetime.now(timezone.utc),
                )
                db.add(doctor)
                db.flush()  # Populates doctor.id for the foreign key

                slug = generate_unique_tenant_slug(db, doctor.full_name)
                tenant = Tenant(
                    doctor_id=doctor.id,
                    slug=slug,
                    status="active",
                )
                db.add(tenant)
                db.commit()
                db.refresh(doctor)
                db.refresh(tenant)
            except Exception as exc:
                db.rollback()
                logger.error("Failed to provision doctor account via Google", exc_info=True)
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to register doctor account. Please try again later.",
                )

        # Generate Platform JWT Access Token
        access_token = create_access_token(subject=str(doctor.id))

        return AuthResponse(
            access_token=access_token,
            token_type="bearer",
            doctor=DoctorResponse.model_validate(doctor),
            tenant=TenantResponse.model_validate(doctor.tenant or tenant),
        )

    @staticmethod
    def register_email(
        db: Session,
        email: str,
        password: str,
        full_name: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> AuthResponse:
        """
        Register a doctor using email and password.
        Atomically creates Doctor and Tenant records.
        """
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required",
            )
        try:
            email = validate_email_id(email)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )
        if not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password is required",
            )
        try:
            password = validate_password_strength(password, email=email)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )

        if full_name:
            try:
                full_name = sanitize_full_name(full_name)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                )

        if phone:
            try:
                phone = sanitize_phone(phone)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                )

        # Check for existing doctor
        existing_doctor = db.query(Doctor).filter(Doctor.email == email).first()
        if existing_doctor:
            if existing_doctor.auth_provider == "google" and not existing_doctor.hashed_password:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This account is registered with Google. Please sign in with Google or reset password.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email already exists",
            )

        # Derive clean doctor name if not provided
        if not full_name or not full_name.strip():
            user_part = email.split("@")[0].replace(".", " ").replace("-", " ").replace("_", " ")
            full_name = f"Dr. {user_part.title()}"
        else:
            full_name = full_name.strip()

        hashed_pw = hash_password(password)

        try:
            doctor = Doctor(
                email=email,
                full_name=full_name,
                phone=phone,
                auth_provider="email",
                hashed_password=hashed_pw,
                is_active=True,
                email_verified=False,
            )
            db.add(doctor)
            db.flush()

            # Retry slug generation with savepoints up to 5 attempts
            tenant = None
            base_slug = slugify(doctor.full_name)
            for attempt in range(5):
                slug = generate_unique_tenant_slug(db, doctor.full_name)
                if attempt > 0:
                    slug = f"{base_slug}-{attempt + 1}-{secrets.token_hex(2)}"
                try:
                    with db.begin_nested():
                        tenant = Tenant(
                            doctor_id=doctor.id,
                            slug=slug,
                            status="active",
                        )
                        db.add(tenant)
                        db.flush()
                    break
                except IntegrityError as e:
                    err_text = str(e).lower()
                    if "slug" in err_text or "tenants" in err_text:
                        tenant = None
                        continue
                    raise

            if not tenant:
                raise RuntimeError("Could not allocate a unique clinic slug.")

            # Create EmailVerificationTokens atomically
            otp, token = generate_verification_token()
            now = datetime.now(timezone.utc)
            expires = now + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES)

            token_otp = EmailVerificationToken(
                doctor_id=doctor.id,
                token_hash=hash_token(otp),
                purpose="email_verification",
                expires_at=expires,
            )
            token_link = EmailVerificationToken(
                doctor_id=doctor.id,
                token_hash=hash_token(token),
                purpose="email_verification",
                expires_at=expires,
            )
            db.add(token_otp)
            db.add(token_link)

            db.commit()
            db.refresh(doctor)
            db.refresh(tenant)
        except IntegrityError as exc:
            db.rollback()
            err_msg = str(exc).lower()
            if "doctors" in err_msg or "email" in err_msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email already exists",
                )
            logger.error("Database integrity error during registration", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to register doctor account. Please try again later.",
            )
        except HTTPException:
            db.rollback()
            raise
        except Exception as exc:
            db.rollback()
            logger.error("Unexpected error during doctor registration", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to register doctor account. Please try again later.",
            )

        # Dispatch verification email outside transaction
        try:
            email_service.send_verification_email(
                to_email=doctor.email,
                doctor_name=doctor.full_name,
                otp=otp,
                token=token,
                tenant_slug=tenant.slug,
            )
        except Exception as exc:
            logger.error(
                "Failed to dispatch verification email on registration",
                email=doctor.email,
                exc_info=True,
            )

        access_token = create_access_token(subject=str(doctor.id))

        return AuthResponse(
            access_token=access_token,
            token_type="bearer",
            doctor=DoctorResponse.model_validate(doctor),
            tenant=TenantResponse.model_validate(tenant),
        )

    @staticmethod
    def login_email(db: Session, email: str, password: str) -> AuthResponse:
        """
        Authenticate a doctor using email and password.
        """
        if not email or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and password are required",
            )
        try:
            email = validate_email_id(email)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )

        doctor = db.query(Doctor).filter(Doctor.email == email).first()
        if not doctor:
            verify_password(password, DUMMY_BCRYPT_HASH)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if not doctor.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Inactive user account",
            )

        if not doctor.hashed_password:
            verify_password(password, DUMMY_BCRYPT_HASH)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account was registered using Google. Please sign in with Google or reset password.",
            )

        if not verify_password(password, doctor.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        if settings.REQUIRE_EMAIL_VERIFICATION and not doctor.email_verified:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Email verification required. Please verify your email before logging in.",
            )

        # Transparently rehash legacy PBKDF2 passwords to bcrypt on successful login
        if needs_rehash(doctor.hashed_password):
            doctor.hashed_password = hash_password(password)
            db.commit()

        tenant = doctor.tenant
        if not tenant:
            slug = generate_unique_tenant_slug(db, doctor.full_name)
            tenant = Tenant(doctor_id=doctor.id, slug=slug, status="active")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        access_token = create_access_token(subject=str(doctor.id))

        return AuthResponse(
            access_token=access_token,
            token_type="bearer",
            doctor=DoctorResponse.model_validate(doctor),
            tenant=TenantResponse.model_validate(tenant),
        )

    @staticmethod
    def verify_email(
        db: Session,
        raw_code_or_token: str,
        email: Optional[str] = None,
    ) -> AuthResponse:
        """
        Validate an email verification OTP or URL-safe token.
        Transitions doctor.email_verified from False to True and returns AuthResponse with JWT.
        """
        if not raw_code_or_token or not raw_code_or_token.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification code or token is required.",
            )
        raw_code = raw_code_or_token.strip()

        if email:
            try:
                email = validate_email_id(email)
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                )

        target_hash = hash_token(raw_code)
        now = datetime.now(timezone.utc)

        doctor: Optional[Doctor] = None
        token_record: Optional[EmailVerificationToken] = None

        if email:
            doctor = db.query(Doctor).filter(Doctor.email == email).first()
            if not doctor:
                verify_password("dummy", DUMMY_BCRYPT_HASH)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid verification code or email.",
                )

            if doctor.locked_until:
                locked_until = doctor.locked_until
                if locked_until.tzinfo is None:
                    locked_until = locked_until.replace(tzinfo=timezone.utc)
                if locked_until > now:
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Account is temporarily locked due to repeated failed attempts. Please try again later.",
                    )

            token_record = (
                db.query(EmailVerificationToken)
                .filter(
                    EmailVerificationToken.doctor_id == doctor.id,
                    EmailVerificationToken.token_hash == target_hash,
                    EmailVerificationToken.purpose == "email_verification",
                )
                .first()
            )
        else:
            token_record = (
                db.query(EmailVerificationToken)
                .filter(
                    EmailVerificationToken.token_hash == target_hash,
                    EmailVerificationToken.purpose == "email_verification",
                )
                .first()
            )
            if token_record:
                doctor = db.query(Doctor).filter(Doctor.id == token_record.doctor_id).first()

        # Handle invalid token or mismatched doctor
        if not token_record or not doctor:
            if doctor:
                doctor.failed_login_attempts = (doctor.failed_login_attempts or 0) + 1
                if doctor.failed_login_attempts >= 5:
                    db.query(EmailVerificationToken).filter(
                        EmailVerificationToken.doctor_id == doctor.id,
                        EmailVerificationToken.purpose == "email_verification",
                        EmailVerificationToken.used_at == None,
                    ).update({"used_at": now})
                    db.commit()
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Too many failed verification attempts. Verification token has been invalidated. Please request a new code.",
                    )
                db.commit()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid verification code or token.",
            )

        # Handle already used token
        if token_record.used_at is not None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token has already been used.",
            )

        # Ensure expires_at is timezone-aware
        expires_at = token_record.expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        # Handle expired token
        if expires_at < now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Verification token has expired. Please request a new code.",
            )

        # Mark all pending verification tokens for this doctor as used (prevent replay)
        db.query(EmailVerificationToken).filter(
            EmailVerificationToken.doctor_id == doctor.id,
            EmailVerificationToken.purpose == "email_verification",
            EmailVerificationToken.used_at == None,
        ).update({"used_at": now})

        doctor.email_verified = True
        doctor.email_verified_at = now
        doctor.failed_login_attempts = 0
        doctor.locked_until = None
        db.commit()
        db.refresh(doctor)

        tenant = doctor.tenant
        if not tenant:
            slug = generate_unique_tenant_slug(db, doctor.full_name)
            tenant = Tenant(doctor_id=doctor.id, slug=slug, status="active")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        access_token = create_access_token(subject=str(doctor.id))

        return AuthResponse(
            access_token=access_token,
            token_type="bearer",
            doctor=DoctorResponse.model_validate(doctor),
            tenant=TenantResponse.model_validate(tenant),
        )

    @staticmethod
    def resend_verification(db: Session, email: str) -> dict:
        """
        Resend a fresh email verification code and URL token to the doctor.
        Rate-limited with a 60-second cooldown per doctor. Invalidates previous unused tokens.
        """
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required.",
            )
        try:
            email = validate_email_id(email)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(exc),
            )

        doctor = db.query(Doctor).filter(Doctor.email == email).first()
        if not doctor:
            # Timing side-channel mitigation
            verify_password("dummy", DUMMY_BCRYPT_HASH)
            return {"message": "If an account exists with this email, a verification code has been sent."}

        if doctor.email_verified:
            return {"message": "Email is already verified."}

        now = datetime.now(timezone.utc)

        # 60s cooldown per doctor
        latest_token = (
            db.query(EmailVerificationToken)
            .filter(
                EmailVerificationToken.doctor_id == doctor.id,
                EmailVerificationToken.purpose == "email_verification",
            )
            .order_by(EmailVerificationToken.created_at.desc())
            .first()
        )
        if latest_token and latest_token.created_at:
            created_at = latest_token.created_at
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            seconds_elapsed = (now - created_at).total_seconds()
            if seconds_elapsed < 60:
                remaining = max(1, int(60 - seconds_elapsed))
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Please wait at least 60 seconds before requesting another verification code.",
                    headers={"Retry-After": str(remaining)},
                )

        # Invalidate prior unused tokens
        db.query(EmailVerificationToken).filter(
            EmailVerificationToken.doctor_id == doctor.id,
            EmailVerificationToken.purpose == "email_verification",
            EmailVerificationToken.used_at == None,
        ).update({"used_at": now})

        # Generate fresh token pair
        otp, token = generate_verification_token()
        expires = now + timedelta(minutes=settings.EMAIL_VERIFICATION_EXPIRE_MINUTES)
        db.add(EmailVerificationToken(
            doctor_id=doctor.id,
            token_hash=hash_token(otp),
            purpose="email_verification",
            expires_at=expires,
        ))
        db.add(EmailVerificationToken(
            doctor_id=doctor.id,
            token_hash=hash_token(token),
            purpose="email_verification",
            expires_at=expires,
        ))
        doctor.failed_login_attempts = 0
        db.commit()

        # Send email
        try:
            email_service.send_verification_email(
                to_email=doctor.email,
                doctor_name=doctor.full_name,
                otp=otp,
                token=token,
                tenant_slug=doctor.tenant.slug if doctor.tenant else None,
            )
        except Exception as exc:
            logger.error(
                "Failed to dispatch resent verification email",
                email=doctor.email,
                exc_info=True,
            )

        return {"message": "Verification email sent successfully."}


auth_service = AuthService()
