from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from app.core.config import get_settings

settings = get_settings()


def verify_google_token(credential: str) -> Dict[str, Any]:
    """
    Verify a Google ID Token (credential) and return user payload.
    Supports development/test tokens when in development mode or testing.
    """
    # Development/Test mock token support
    if settings.ENVIRONMENT == "development" and credential.startswith("mock-google-token:"):
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
