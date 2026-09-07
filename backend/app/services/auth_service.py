import re
import uuid
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    verify_google_token,
    create_access_token,
    hash_password,
    verify_password,
)
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.schemas.auth import (
    AuthResponse,
    DoctorResponse,
    TenantResponse,
)


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
            
            # Update provider info if missing
            updated = False
            if not doctor.provider_id and provider_id:
                doctor.provider_id = provider_id
                updated = True
            if avatar_url and doctor.avatar_url != avatar_url:
                doctor.avatar_url = avatar_url
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
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Failed to provision doctor account: {str(exc)}",
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
        email = email.lower().strip()
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required",
            )
        if not password or len(password) < 6:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password must be at least 6 characters long",
            )

        # Check for existing doctor
        existing_doctor = db.query(Doctor).filter(Doctor.email == email).first()
        if existing_doctor:
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
            )
            db.add(doctor)
            db.flush()

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
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to register doctor account: {str(exc)}",
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
        email = email.lower().strip()
        if not email or not password:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email and password are required",
            )

        doctor = db.query(Doctor).filter(Doctor.email == email).first()
        if not doctor:
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
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This account was registered using Google. Please sign in with Google or reset password.",
            )

        if not verify_password(password, doctor.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

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


auth_service = AuthService()
