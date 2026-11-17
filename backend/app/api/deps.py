import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.doctor import Doctor
from app.models.staff import StaffMember, is_doctor_role

# HTTP Bearer token extractor
security_scheme = HTTPBearer(auto_error=True)


def get_current_doctor(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> Doctor:
    """
    Dependency that extracts the Bearer JWT token from the Authorization header,
    validates the token, and returns the active Doctor for the tenant context.
    If a staff member is authenticated, returns their clinic Doctor with
    _current_staff attached so multi-tenant operations scoped to doctor.id work seamlessly.
    """
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = decode_access_token(token)
        sub_str: str = payload.get("sub")
        if sub_str is None:
            raise credentials_exception
        user_id = uuid.UUID(sub_str)
        user_type: str = payload.get("user_type", "doctor")
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    # Handle Staff Member authentication
    if user_type == "staff":
        staff = db.query(StaffMember).filter(StaffMember.id == user_id).first()
        if staff is None or not staff.can_login:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Staff portal access is disabled or revoked",
                headers={"WWW-Authenticate": "Bearer"},
            )
        if staff.status != "active":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Staff account is inactive or suspended",
                headers={"WWW-Authenticate": "Bearer"},
            )

        jwt_token_version = payload.get("token_version")
        if jwt_token_version is not None and staff.token_version != jwt_token_version:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Credentials have changed. Please log in again.",
                headers={"WWW-Authenticate": "Bearer"},
            )

        doctor = db.query(Doctor).filter(Doctor.id == staff.doctor_id).first()
        if doctor is None or not doctor.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Clinic account is inactive",
                headers={"WWW-Authenticate": "Bearer"},
            )

        doctor._current_staff = staff
        doctor._is_staff = True
        doctor._staff_id = staff.id
        return doctor

    # Handle Doctor Owner authentication
    doctor = db.query(Doctor).filter(Doctor.id == user_id).first()
    if doctor is None:
        raise credentials_exception
    if not doctor.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
        )

    doctor._current_staff = None
    doctor._is_staff = False
    return doctor


def require_doctor_owner(
    current_doctor: Doctor = Depends(get_current_doctor),
) -> Doctor:
    """
    Dependency that guarantees only the primary clinic Doctor/Admin can perform the action
    (e.g., managing clinic roster, issuing credentials, financial administration).
    """
    if getattr(current_doctor, "_is_staff", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to clinic administrator only",
        )
    return current_doctor


def is_staff_doctor(doctor: Doctor) -> bool:
    """
    Returns True if the authenticated user is an employed clinic doctor (Staff Doctor).
    Employed doctors have clinical privileges (consultations, view own bookings, mark completed)
    but cannot manage clinic appointments, reschedule other doctors, or book appointments.
    Uses the canonical is_doctor_role classifier across all medical specialties.
    """
    staff = getattr(doctor, "_current_staff", None)
    if not staff:
        return False
    return staff.is_doctor
