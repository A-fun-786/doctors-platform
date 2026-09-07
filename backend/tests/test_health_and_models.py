import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker
from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
import uuid


# In-memory SQLite engine for fast testing
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=test_engine)


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def test_root_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_api_v1_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "service": "doctor-platform-api",
    }


def test_api_v1_health_database_connected(client):
    response = client.get("/api/v1/health/database")
    assert response.status_code == 200
    assert response.json() == {
        "status": "healthy",
        "database": "connected",
    }


def test_api_v1_health_database_disconnected():
    # Test when database query fails
    class FailingSession:
        def execute(self, *args, **kwargs):
            raise Exception("Database unreachable")

    def failing_get_db():
        yield FailingSession()

    app.dependency_overrides[get_db] = failing_get_db
    with TestClient(app) as broken_client:
        response = broken_client.get("/api/v1/health/database")
        assert response.status_code == 503
        data = response.json()
        assert data["detail"]["status"] == "unhealthy"
        assert data["detail"]["database"] == "disconnected"
    app.dependency_overrides.clear()


def test_cors_headers(client):
    response = client.options(
        "/api/v1/health",
        headers={
            "Origin": "http://localhost:3000",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3000"


def test_openapi_schema_contains_expected_routes(client):
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    # Health endpoints
    assert "/health" in paths
    assert "/api/v1/health" in paths
    assert "/api/v1/health/database" in paths
    # Phase 3 Auth endpoints
    assert "/api/v1/auth/google" in paths
    assert "/api/v1/auth/me" in paths
    # Verify no premature CRUD endpoints
    assert "/api/v1/doctors" not in paths
    assert "/api/v1/tenants" not in paths


def test_doctor_tenant_relationship(db_session):
    # Test model definition and 1:1 relationship
    doctor = Doctor(
        email="doctor.test@example.com",
        full_name="Dr. Jane Doe",
        phone="+1234567890",
        is_active=True,
    )
    db_session.add(doctor)
    db_session.commit()
    db_session.refresh(doctor)

    assert doctor.id is not None
    assert doctor.email == "doctor.test@example.com"
    assert doctor.is_active is True

    tenant = Tenant(
        doctor_id=doctor.id,
        slug="dr-jane-doe",
        status="active",
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)

    assert tenant.id is not None
    assert tenant.doctor.full_name == "Dr. Jane Doe"
    assert doctor.tenant.slug == "dr-jane-doe"
