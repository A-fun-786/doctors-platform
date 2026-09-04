import pytest
import uuid
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import get_db
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.core.security import create_access_token
from app.services.auth_service import generate_unique_tenant_slug, slugify

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


def test_slugify_helper():
    assert slugify("Dr. Ahmed Khan") == "dr-ahmed-khan"
    assert slugify("Dr. Sarah O'Connor, MD") == "dr-sarah-oconnor-md"
    assert slugify("   Specialist Clinic #1  ") == "specialist-clinic-1"
    assert slugify("") == "doctor"


def test_unique_tenant_slug_generation(db_session):
    # Setup initial doctor & tenant
    doc1 = Doctor(
        email="doc1@example.com",
        full_name="Dr. Jane Smith",
        auth_provider="google",
    )
    db_session.add(doc1)
    db_session.flush()

    tenant1 = Tenant(doctor_id=doc1.id, slug="dr-jane-smith")
    db_session.add(tenant1)
    db_session.commit()

    # Second slug generation should detect collision and append -2
    slug2 = generate_unique_tenant_slug(db_session, "Dr. Jane Smith")
    assert slug2 == "dr-jane-smith-2"

    # Add second tenant and check third
    doc2 = Doctor(
        email="doc2@example.com",
        full_name="Dr. Jane Smith",
        auth_provider="google",
    )
    db_session.add(doc2)
    db_session.flush()
    tenant2 = Tenant(doctor_id=doc2.id, slug=slug2)
    db_session.add(tenant2)
    db_session.commit()

    slug3 = generate_unique_tenant_slug(db_session, "Dr. Jane Smith")
    assert slug3 == "dr-jane-smith-3"


def test_google_auth_new_doctor_registration(client, db_session):
    # Use development mock token format: mock-google-token:email:name:provider_id:avatar_url
    mock_token = "mock-google-token:ahmed@example.com:Dr. Ahmed Khan:google-sub-101:https://lh3.googleusercontent.com/photo.jpg"
    
    response = client.post(
        "/api/v1/auth/google",
        json={"credential": mock_token},
    )
    assert response.status_code == 200
    data = response.json()

    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["doctor"]["email"] == "ahmed@example.com"
    assert data["doctor"]["full_name"] == "Dr. Ahmed Khan"
    assert data["doctor"]["avatar_url"] == "https://lh3.googleusercontent.com/photo.jpg"
    assert data["doctor"]["auth_provider"] == "google"
    assert data["tenant"]["slug"] == "dr-ahmed-khan"

    # Verify DB persistence
    doctor = db_session.query(Doctor).filter(Doctor.email == "ahmed@example.com").first()
    assert doctor is not None
    assert doctor.provider_id == "google-sub-101"
    assert doctor.tenant is not None
    assert doctor.tenant.slug == "dr-ahmed-khan"


def test_google_auth_existing_doctor_login(client, db_session):
    # 1. Register first
    mock_token = "mock-google-token:existing@example.com:Dr. Existing:google-sub-202:https://example.com/p1.jpg"
    res1 = client.post("/api/v1/auth/google", json={"credential": mock_token})
    assert res1.status_code == 200
    doc_id = res1.json()["doctor"]["id"]
    tenant_slug = res1.json()["tenant"]["slug"]

    # 2. Login again with same email (possibly updated avatar)
    updated_token = "mock-google-token:existing@example.com:Dr. Existing:google-sub-202:https://example.com/p2.jpg"
    res2 = client.post("/api/v1/auth/google", json={"credential": updated_token})
    assert res2.status_code == 200
    data2 = res2.json()

    assert data2["doctor"]["id"] == doc_id
    assert data2["tenant"]["slug"] == tenant_slug
    assert data2["doctor"]["avatar_url"] == "https://example.com/p2.jpg"

    # Ensure no duplicate doctor or tenant was created
    assert db_session.query(Doctor).count() == 1
    assert db_session.query(Tenant).count() == 1


def test_get_current_doctor_me(client, db_session):
    # Create doctor and tenant
    doctor = Doctor(
        email="dr.sarah@example.com",
        full_name="Dr. Sarah Connor",
        auth_provider="google",
        provider_id="google-sub-303",
        is_active=True,
    )
    db_session.add(doctor)
    db_session.flush()

    tenant = Tenant(
        doctor_id=doctor.id,
        slug="dr-sarah-connor",
        status="active",
    )
    db_session.add(tenant)
    db_session.commit()

    # Generate token
    token = create_access_token(subject=str(doctor.id))

    # Access /me
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "dr.sarah@example.com"
    assert data["full_name"] == "Dr. Sarah Connor"
    assert data["tenant"]["slug"] == "dr-sarah-connor"


def test_get_me_unauthorized_invalid_token(client):
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": "Bearer invalid.jwt.token"},
    )
    assert response.status_code == 401


def test_get_me_missing_token(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_inactive_doctor_cannot_authenticate(client, db_session):
    doctor = Doctor(
        email="inactive@example.com",
        full_name="Dr. Inactive",
        auth_provider="google",
        is_active=False,
    )
    db_session.add(doctor)
    db_session.commit()

    mock_token = "mock-google-token:inactive@example.com:Dr. Inactive:sub-999:"
    response = client.post("/api/v1/auth/google", json={"credential": mock_token})
    assert response.status_code == 401
    assert "Inactive" in response.json()["detail"]
