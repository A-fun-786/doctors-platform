import pytest
from fastapi import Request
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.rate_limit import get_client_ip
from app.main import app


def test_production_cors_validation():
    """Verify production settings validate and protect CORS_ORIGINS."""
    # Wildcard origin is rejected in production
    with pytest.raises(ValueError, match="CORS_ORIGINS cannot contain wildcard"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            ALLOW_MOCK_AUTH=False,
            JWT_SECRET_KEY="a" * 32,
            GOOGLE_CLIENT_ID="valid-id",
            DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/db",
            CORS_ORIGINS="*",
        )

    # Empty origin is rejected in production
    with pytest.raises(ValueError, match="CORS_ORIGINS must not be empty"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            ALLOW_MOCK_AUTH=False,
            JWT_SECRET_KEY="a" * 32,
            GOOGLE_CLIENT_ID="valid-id",
            DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/db",
            CORS_ORIGINS="",
        )

    # Invalid scheme is rejected
    with pytest.raises(ValueError, match="Invalid CORS origin"):
        Settings(
            _env_file=None,
            ENVIRONMENT="production",
            ALLOW_MOCK_AUTH=False,
            JWT_SECRET_KEY="a" * 32,
            GOOGLE_CLIENT_ID="valid-id",
            DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/db",
            CORS_ORIGINS="ftp://invalid.domain.com",
        )

    # Valid HTTPS production domain passes
    prod_settings = Settings(
        _env_file=None,
        ENVIRONMENT="production",
        ALLOW_MOCK_AUTH=False,
        JWT_SECRET_KEY="a" * 32,
        GOOGLE_CLIENT_ID="valid-id",
        DATABASE_URL="postgresql+psycopg://user:pass@localhost:5432/db",
        CORS_ORIGINS="https://doctors.example.com, https://admin.example.com",
    )
    assert prod_settings.CORS_ORIGINS == [
        "https://doctors.example.com",
        "https://admin.example.com",
    ]


def test_get_client_ip_resolution():
    """Verify get_client_ip accurately parses proxy headers."""
    # Case 1: X-Forwarded-For with multiple proxy hops
    scope = {
        "type": "http",
        "headers": [
            (b"x-forwarded-for", b"203.0.113.195, 70.41.3.18, 150.172.238.178"),
        ],
        "client": ("172.18.0.4", 8000),
    }
    request = Request(scope)
    assert get_client_ip(request) == "203.0.113.195"

    # Case 2: Single IP in X-Forwarded-For
    scope = {
        "type": "http",
        "headers": [
            (b"x-forwarded-for", b"198.51.100.42"),
        ],
        "client": ("172.18.0.4", 8000),
    }
    request = Request(scope)
    assert get_client_ip(request) == "198.51.100.42"

    # Case 3: X-Real-IP fallback when X-Forwarded-For is absent
    scope = {
        "type": "http",
        "headers": [
            (b"x-real-ip", b"198.51.100.99"),
        ],
        "client": ("172.18.0.4", 8000),
    }
    request = Request(scope)
    assert get_client_ip(request) == "198.51.100.99"

    # Case 4: Direct connection fallback to request.client.host
    scope = {
        "type": "http",
        "headers": [],
        "client": ("192.168.1.50", 55210),
    }
    request = Request(scope)
    assert get_client_ip(request) == "192.168.1.50"

    # Case 5: Missing client falls back to loopback
    scope = {
        "type": "http",
        "headers": [],
        "client": None,
    }
    request = Request(scope)
    assert get_client_ip(request) == "127.0.0.1"


def test_cors_preflight_and_access_control():
    """Verify CORS headers for authorized origins and rejection of unauthorized origins."""
    client = TestClient(app)

    # Allowed Origin preflight request
    headers = {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Authorization,Content-Type",
    }
    response = client.options("/api/v1/auth/login", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert response.headers.get("access-control-allow-credentials") == "true"

    # Unauthorized Origin preflight request does NOT get allow-origin header
    unauth_headers = {
        "Origin": "https://malicious-site.com",
        "Access-Control-Request-Method": "POST",
    }
    unauth_response = client.options("/api/v1/auth/login", headers=unauth_headers)
    assert "access-control-allow-origin" not in unauth_response.headers


def test_proxy_and_tls_artifacts_exist():
    """Ensure production proxy files, templates, and certificates are present."""
    from pathlib import Path

    root_dir = Path(__file__).resolve().parent.parent.parent
    nginx_conf = root_dir / "nginx" / "nginx.conf"
    default_conf = root_dir / "nginx" / "conf.d" / "default.conf"
    dev_proxy_conf = root_dir / "nginx" / "conf.d" / "dev-proxy.conf.example"
    caddyfile = root_dir / "proxy" / "Caddyfile"
    cert_script = root_dir / "nginx" / "certs" / "generate-dev-certs.sh"
    cert_file = root_dir / "nginx" / "certs" / "fullchain.pem"
    key_file = root_dir / "nginx" / "certs" / "privkey.pem"

    assert nginx_conf.is_file(), f"Missing {nginx_conf}"
    assert default_conf.is_file(), f"Missing {default_conf}"
    assert dev_proxy_conf.is_file(), f"Missing {dev_proxy_conf}"
    assert caddyfile.is_file(), f"Missing {caddyfile}"
    assert cert_script.is_file(), f"Missing {cert_script}"

    if not (cert_file.is_file() and key_file.is_file()):
        import subprocess
        subprocess.run(["bash", str(cert_script)], check=True)

    assert cert_file.is_file(), f"Missing {cert_file}"
    assert key_file.is_file(), f"Missing {key_file}"

    # Verify critical Nginx directives exist
    default_content = default_conf.read_text()
    assert "Strict-Transport-Security" in default_content
    assert "Content-Security-Policy" in default_content
    assert "X-Content-Type-Options" in default_content
    assert "X-Frame-Options" in default_content
    assert "/_next/static/" in default_content
    assert "proxy_pass http://frontend_upstream;" in default_content
    assert "proxy_pass http://backend_upstream;" in default_content

