import uuid
from typing import Generator
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.doctor import Doctor

# HTTP Bearer token extractor
security_scheme = HTTPBearer(auto_error=True)


def get_current_doctor(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: Session = Depends(get_db),
) -> Doctor:
    """
    Dependency that extracts the Bearer JWT token from the Authorization header,
    validates the token, and returns the current active Doctor with their Tenant.
    """
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = decode_access_token(token)
        doctor_id_str: str = payload.get("sub")
        if doctor_id_str is None:
            raise credentials_exception
        doctor_id = uuid.UUID(doctor_id_str)
    except (jwt.PyJWTError, ValueError):
        raise credentials_exception

    doctor = db.query(Doctor).filter(Doctor.id == doctor_id).first()
    if doctor is None:
        raise credentials_exception
    if not doctor.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
        )

    return doctor
