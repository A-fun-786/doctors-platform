import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from passlib.context import CryptContext
from app.core.config import get_settings

settings = get_settings()

# Bcrypt context for all new password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Hash a plaintext password using bcrypt."""
    return pwd_context.hash(password)


def _verify_legacy_pbkdf2(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a legacy PBKDF2-HMAC-SHA256 hash (format: <hex_salt>$<hex_hash>)."""
    try:
        salt, stored_hash = hashed_password.split("$", 1)
        key = hashlib.pbkdf2_hmac(
            "sha256",
            plain_password.encode("utf-8"),
            bytes.fromhex(salt),
            100000,
        )
        return secrets.compare_digest(key.hex(), stored_hash)
    except Exception:
        return False


def _is_bcrypt_hash(hashed_password: str) -> bool:
    """Check if a hash is a bcrypt hash (starts with $2b$ or $2a$)."""
    return hashed_password.startswith(("$2b$", "$2a$"))


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against its stored hash (bcrypt or legacy PBKDF2)."""
    if not hashed_password:
        return False
    if _is_bcrypt_hash(hashed_password):
        return pwd_context.verify(plain_password, hashed_password)
    # Fall back to legacy PBKDF2 for pre-migration hashes
    if "$" in hashed_password:
        return _verify_legacy_pbkdf2(plain_password, hashed_password)
    return False


def needs_rehash(hashed_password: str) -> bool:
    """Return True if the stored hash should be re-hashed to bcrypt (i.e. it's a legacy PBKDF2 hash)."""
    if not hashed_password:
        return False
    if not _is_bcrypt_hash(hashed_password):
        return True
    return pwd_context.needs_update(hashed_password)


def verify_google_token(credential: str) -> Dict[str, Any]:
    """
    Verify a Google ID Token (credential) and return user payload.
    Supports mock tokens only when ALLOW_MOCK_AUTH is enabled.
    """
    # Mock token support strictly controlled by explicit flag
    if settings.ALLOW_MOCK_AUTH and credential.startswith("mock-google-token:"):
        # Format: mock-google-token:email:name:provider_id:avatar_url
        parts = credential.split(":", 4)
        email = parts[1] if len(parts) > 1 else "doctor@example.com"
        name = parts[2] if len(parts) > 2 else "Dr. Test Doctor"
        sub = parts[3] if len(parts) > 3 else "mock-google-sub-12345"
        picture = parts[4] if len(parts) > 4 else None
        return {
            "email": email,
            "name": name,
            "sub": sub,
            "picture": picture,
            "email_verified": True,
        }

    # Official Google ID Token verification
    request = google_requests.Request()
    audience = settings.GOOGLE_CLIENT_ID if settings.GOOGLE_CLIENT_ID else None
    
    id_info = id_token.verify_oauth2_token(credential, request, audience=audience)
    
    if id_info.get("iss") not in ["accounts.google.com", "https://accounts.google.com"]:
        raise ValueError("Invalid token issuer")
        
    return id_info


def create_access_token(
    subject: str,
    expires_delta: Optional[timedelta] = None,
) -> str:
    """Create a signed JWT access token for a doctor."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode = {
        "sub": str(subject),
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> Dict[str, Any]:
    """Decode and validate a platform JWT access token."""
    payload = jwt.decode(
        token,
        settings.JWT_SECRET_KEY,
        algorithms=[settings.JWT_ALGORITHM],
    )
    return payload
