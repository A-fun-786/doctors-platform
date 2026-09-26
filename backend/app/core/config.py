from functools import lru_cache
from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    APP_NAME: str = "Doctor Platform API"
    ENVIRONMENT: str = "development"
    DATABASE_URL: str = (
        "postgresql+psycopg://postgres:postgres@localhost:5432/doctor_platform"
    )
    CORS_ORIGINS: Union[List[str], str] = "http://localhost:3000"

    # Authentication & Security
    ALLOW_MOCK_AUTH: bool = False
    GOOGLE_CLIENT_ID: str = ""
    JWT_SECRET_KEY: str = "docspace-super-secret-jwt-key-minimum-32-chars-for-hs256"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # Rate Limiting (SlowAPI)
    RATE_LIMIT_GLOBAL: str = "100/minute"
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_AUTH_GOOGLE: str = "10/minute"

    # Observability & Monitoring (Sentry & Structlog)
    SENTRY_DSN: str = ""
    SENTRY_TRACES_SAMPLE_RATE: float = 0.1
    SENTRY_PROFILES_SAMPLE_RATE: float = 0.1
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" for structured production logs, "console" for dev

    # Cloud Storage (Cloudflare R2 / S3-compatible / Local fallback)
    STORAGE_BACKEND: str = "local"  # "local" or "s3"
    STORAGE_LOCAL_DIR: str = "uploads"
    S3_BUCKET_NAME: str = ""
    S3_ENDPOINT_URL: str = ""  # e.g. https://<account_id>.r2.cloudflarestorage.com
    S3_ACCESS_KEY_ID: str = ""
    S3_SECRET_ACCESS_KEY: str = ""
    S3_REGION_NAME: str = "auto"
    S3_PUBLIC_CUSTOM_DOMAIN: str = ""  # e.g. https://uploads.yourdomain.com

    @field_validator("CORS_ORIGINS", mode="after")

    @classmethod
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @model_validator(mode="after")
    def validate_production_settings(self) -> "Settings":
        if self.ENVIRONMENT.lower() == "production":
            if self.ALLOW_MOCK_AUTH:
                raise ValueError("ALLOW_MOCK_AUTH must be False in production.")
            insecure_keys = {
                "",
                "docspace-super-secret-jwt-key-minimum-32-chars-for-hs256",
                "replace-with-secure-secret-minimum-32-chars-long",
            }
            if not self.JWT_SECRET_KEY or self.JWT_SECRET_KEY in insecure_keys or len(self.JWT_SECRET_KEY) < 32:
                raise ValueError("A secure JWT_SECRET_KEY (>= 32 chars) must be set in production.")
            if not self.GOOGLE_CLIENT_ID or not self.GOOGLE_CLIENT_ID.strip():
                raise ValueError("GOOGLE_CLIENT_ID must be set in production.")
            if self.DATABASE_URL.startswith("sqlite"):
                raise ValueError("SQLite is not supported in production. Use PostgreSQL DATABASE_URL.")

        if self.STORAGE_BACKEND.lower() == "s3":
            if not self.S3_BUCKET_NAME or not self.S3_BUCKET_NAME.strip():
                raise ValueError("S3_BUCKET_NAME must be set when STORAGE_BACKEND is 's3'.")
            if not self.S3_ACCESS_KEY_ID or not self.S3_SECRET_ACCESS_KEY:
                raise ValueError("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be set when STORAGE_BACKEND is 's3'.")

        return self



@lru_cache
def get_settings() -> Settings:
    return Settings()
