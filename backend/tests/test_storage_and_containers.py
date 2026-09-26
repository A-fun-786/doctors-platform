import io
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.storage import (
    LocalStorage,
    S3Storage,
    get_storage,
    reset_storage,
)
from app.main import app


def test_local_storage_crud(tmp_path):
    storage = LocalStorage(base_dir=str(tmp_path))
    content = b"test file content"
    dest = "icons/sample.png"

    # Save
    saved_key = storage.save_file(content, dest, content_type="image/png")
    assert saved_key == "icons/sample.png"

    # Retrieve
    retrieved_data, content_type = storage.get_file(dest)
    assert retrieved_data == content
    assert content_type == "image/png"

    # URL
    url = storage.get_url(dest)
    assert url == "/uploads/icons/sample.png"

    # Delete
    assert storage.delete_file(dest) is True
    assert storage.delete_file("icons/nonexistent.png") is False


def test_local_storage_path_traversal_protection(tmp_path):
    storage = LocalStorage(base_dir=str(tmp_path))
    with pytest.raises(ValueError, match="Path traversal"):
        storage.save_file(b"bad", "../../secret.txt")


def test_s3_storage_mocked():
    with patch("boto3.client") as mock_boto:
        mock_client = MagicMock()
        mock_boto.return_value = mock_client
        mock_client.get_object.return_value = {
            "Body": io.BytesIO(b"s3 payload"),
            "ContentType": "image/png",
        }
        mock_client.generate_presigned_url.return_value = "https://r2.cloudflarestorage.com/test?token=123"

        with patch("app.core.storage.get_settings") as mock_settings:
            settings_mock = MagicMock()
            settings_mock.STORAGE_BACKEND = "s3"
            settings_mock.S3_BUCKET_NAME = "my-r2-bucket"
            settings_mock.S3_ENDPOINT_URL = "https://acc.r2.cloudflarestorage.com"
            settings_mock.S3_ACCESS_KEY_ID = "key"
            settings_mock.S3_SECRET_ACCESS_KEY = "secret"
            settings_mock.S3_REGION_NAME = "auto"
            settings_mock.S3_PUBLIC_CUSTOM_DOMAIN = ""
            mock_settings.return_value = settings_mock

            storage = S3Storage()

            # Save
            storage.save_file(b"s3 payload", "icons/icon.png", content_type="image/png")
            mock_client.put_object.assert_called_once_with(
                Bucket="my-r2-bucket",
                Key="icons/icon.png",
                Body=b"s3 payload",
                ContentType="image/png",
            )

            # Retrieve
            data, ctype = storage.get_file("icons/icon.png")
            assert data == b"s3 payload"
            assert ctype == "image/png"

            # URL
            presigned_url = storage.get_url("icons/icon.png")
            assert "r2.cloudflarestorage.com" in presigned_url

            # Delete
            assert storage.delete_file("icons/icon.png") is True
            mock_client.delete_object.assert_called_once_with(
                Bucket="my-r2-bucket", Key="icons/icon.png"
            )


def test_s3_public_custom_domain():
    with patch("boto3.client"):
        with patch("app.core.storage.get_settings") as mock_settings:
            settings_mock = MagicMock()
            settings_mock.STORAGE_BACKEND = "s3"
            settings_mock.S3_BUCKET_NAME = "my-bucket"
            settings_mock.S3_ENDPOINT_URL = ""
            settings_mock.S3_ACCESS_KEY_ID = "k"
            settings_mock.S3_SECRET_ACCESS_KEY = "s"
            settings_mock.S3_REGION_NAME = "auto"
            settings_mock.S3_PUBLIC_CUSTOM_DOMAIN = "https://cdn.docspace.app"
            mock_settings.return_value = settings_mock

            storage = S3Storage()
            url = storage.get_url("icons/dr_smith.png")
            assert url == "https://cdn.docspace.app/icons/dr_smith.png"


def test_storage_factory_selection():
    reset_storage()
    with patch("app.core.storage.get_settings") as mock_settings:
        mock_settings.return_value.STORAGE_BACKEND = "local"
        mock_settings.return_value.STORAGE_LOCAL_DIR = "uploads"
        inst = get_storage()
        assert isinstance(inst, LocalStorage)

    reset_storage()


def test_s3_config_validation():
    # S3 backend missing bucket name raises ValueError
    with pytest.raises(ValueError, match="S3_BUCKET_NAME must be set"):
        Settings(
            ENVIRONMENT="development",
            STORAGE_BACKEND="s3",
            S3_BUCKET_NAME="",
            S3_ACCESS_KEY_ID="key",
            S3_SECRET_ACCESS_KEY="secret",
        )

    # S3 backend missing access keys raises ValueError
    with pytest.raises(ValueError, match="S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY"):
        Settings(
            ENVIRONMENT="development",
            STORAGE_BACKEND="s3",
            S3_BUCKET_NAME="bucket",
            S3_ACCESS_KEY_ID="",
            S3_SECRET_ACCESS_KEY="",
        )


def test_static_uploads_serving(tmp_path):
    storage = LocalStorage(base_dir=str(tmp_path))
    storage.save_file(b"hello image", "icons/test.png", content_type="image/png")

    # With TestClient, check that uploads endpoint serves files
    client = TestClient(app)
    # The uploads endpoint mounts settings.STORAGE_LOCAL_DIR
    # Save directly to uploads directory to test static serving
    from app.core.config import get_settings
    settings = get_settings()
    local_target = Path(settings.STORAGE_LOCAL_DIR) / "test_ping.txt"
    local_target.parent.mkdir(parents=True, exist_ok=True)
    local_target.write_bytes(b"pong")

    try:
        response = client.get("/uploads/test_ping.txt")
        assert response.status_code == 200
        assert response.content == b"pong"
    finally:
        if local_target.exists():
            local_target.unlink()

