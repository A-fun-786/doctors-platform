from abc import ABC, abstractmethod
from pathlib import Path
from typing import Optional, Tuple, BinaryIO, Union

import structlog
from app.core.config import get_settings

logger = structlog.get_logger(__name__)


class BaseStorage(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    def save_file(
        self,
        file_content: Union[bytes, BinaryIO],
        destination_path: str,
        content_type: Optional[str] = None,
    ) -> str:
        """
        Saves file bytes or stream to destination path.
        Returns the resolved identifier or URL.
        """
        pass

    @abstractmethod
    def get_file(self, file_path: str) -> Tuple[bytes, Optional[str]]:
        """
        Retrieves file bytes and content type.
        Raises FileNotFoundError if file is missing.
        """
        pass

    @abstractmethod
    def delete_file(self, file_path: str) -> bool:
        """Deletes file at file_path. Returns True if deleted, False otherwise."""
        pass

    @abstractmethod
    def get_url(self, file_path: str, expires_in: int = 3600) -> str:
        """Returns a direct or signed URL to access the file."""
        pass


class LocalStorage(BaseStorage):
    """Local filesystem storage backend for local development and testing."""

    def __init__(self, base_dir: Optional[str] = None):
        settings = get_settings()
        self.base_dir = Path(base_dir or settings.STORAGE_LOCAL_DIR).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)
        logger.info("initialized_local_storage", base_dir=str(self.base_dir))

    def _resolve_safe_path(self, file_path: str) -> Path:
        clean_path = file_path.lstrip("/\\")
        target = (self.base_dir / clean_path).resolve()
        if not str(target).startswith(str(self.base_dir)):
            raise ValueError(f"Path traversal detected: {file_path}")
        return target

    def save_file(
        self,
        file_content: Union[bytes, BinaryIO],
        destination_path: str,
        content_type: Optional[str] = None,
    ) -> str:
        target = self._resolve_safe_path(destination_path)
        target.parent.mkdir(parents=True, exist_ok=True)

        if isinstance(file_content, bytes):
            data = file_content
        else:
            data = file_content.read()

        with open(target, "wb") as f:
            f.write(data)

        logger.info("local_storage_file_saved", path=str(target), size=len(data))
        return destination_path.lstrip("/")

    def get_file(self, file_path: str) -> Tuple[bytes, Optional[str]]:
        target = self._resolve_safe_path(file_path)
        if not target.is_file():
            raise FileNotFoundError(f"File not found: {file_path}")

        import mimetypes
        content_type, _ = mimetypes.guess_type(str(target))
        with open(target, "rb") as f:
            data = f.read()

        return data, content_type

    def delete_file(self, file_path: str) -> bool:
        try:
            target = self._resolve_safe_path(file_path)
            if target.is_file():
                target.unlink()
                logger.info("local_storage_file_deleted", path=str(target))
                return True
            return False
        except Exception as e:
            logger.warning("local_storage_delete_failed", path=file_path, error=str(e))
            return False

    def get_url(self, file_path: str, expires_in: int = 3600) -> str:
        clean = file_path.lstrip("/")
        return f"/uploads/{clean}"


class S3Storage(BaseStorage):
    """
    S3-compatible storage backend for Cloudflare R2, AWS S3, or MinIO.
    Zero egress cost with Cloudflare R2.
    """

    def __init__(self):
        import boto3
        from botocore.config import Config

        settings = get_settings()
        self.bucket_name = settings.S3_BUCKET_NAME
        self.public_domain = settings.S3_PUBLIC_CUSTOM_DOMAIN.rstrip("/")

        boto_config = Config(
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        )

        client_kwargs = {
            "service_name": "s3",
            "aws_access_key_id": settings.S3_ACCESS_KEY_ID,
            "aws_secret_access_key": settings.S3_SECRET_ACCESS_KEY,
            "config": boto_config,
        }

        if settings.S3_ENDPOINT_URL:
            client_kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
        if settings.S3_REGION_NAME:
            client_kwargs["region_name"] = settings.S3_REGION_NAME

        self.s3_client = boto3.client(**client_kwargs)
        logger.info(
            "initialized_s3_storage",
            bucket=self.bucket_name,
            endpoint=settings.S3_ENDPOINT_URL or "default_aws",
        )

    def save_file(
        self,
        file_content: Union[bytes, BinaryIO],
        destination_path: str,
        content_type: Optional[str] = None,
    ) -> str:
        key = destination_path.lstrip("/")
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type

        if isinstance(file_content, bytes):
            body = file_content
        else:
            body = file_content.read()

        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=body,
            **extra_args,
        )

        logger.info("s3_file_uploaded", bucket=self.bucket_name, key=key, size=len(body))
        return key

    def get_file(self, file_path: str) -> Tuple[bytes, Optional[str]]:
        key = file_path.lstrip("/")
        try:
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
            body = response["Body"].read()
            content_type = response.get("ContentType")
            return body, content_type
        except Exception as e:
            logger.error("s3_file_retrieve_failed", bucket=self.bucket_name, key=key, error=str(e))
            raise FileNotFoundError(f"File {key} not found in S3 bucket {self.bucket_name}") from e

    def delete_file(self, file_path: str) -> bool:
        key = file_path.lstrip("/")
        try:
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            logger.info("s3_file_deleted", bucket=self.bucket_name, key=key)
            return True
        except Exception as e:
            logger.warning("s3_file_delete_failed", bucket=self.bucket_name, key=key, error=str(e))
            return False

    def get_url(self, file_path: str, expires_in: int = 3600) -> str:
        key = file_path.lstrip("/")
        if self.public_domain:
            return f"{self.public_domain}/{key}"

        # Generate presigned URL
        return self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )


_storage_instance: Optional[BaseStorage] = None


def get_storage() -> BaseStorage:
    """Singleton getter for the configured storage provider."""
    global _storage_instance
    if _storage_instance is None:
        settings = get_settings()
        if settings.STORAGE_BACKEND.lower() == "s3":
            _storage_instance = S3Storage()
        else:
            _storage_instance = LocalStorage()
    return _storage_instance


def reset_storage():
    """Reset storage instance (used for testing)."""
    global _storage_instance
    _storage_instance = None

