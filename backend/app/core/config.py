from functools import lru_cache
from typing import List, Union
from pydantic import field_validator
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


@lru_cache
def get_settings() -> Settings:
    return Settings()
