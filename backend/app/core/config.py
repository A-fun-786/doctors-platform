from functools import lru_cache
from typing import List, Union
from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
