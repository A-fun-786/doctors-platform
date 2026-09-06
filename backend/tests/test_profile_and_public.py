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


def test_doctor_profile_flow_and_public_sync(client, db_session):
    # 1. Seed doctor and tenant
    doctor = Doctor(
        email="dr.khan@example.com",
        full_name="Dr. Ahmed Khan",
        auth_provider="email",
        is_active=True,
    )
    db_session.add(doctor)
    db_session.commit()
    db_session.refresh(doctor)

    tenant = Tenant(
        doctor_id=doctor.id,
        slug="dr-ahmed-khan",
        status="active",
        service_appointment=True,
        service_video_consultation=True,
        service_medicine_inventory=False,
        service_lab_reports=False,
    )
    db_session.add(tenant)
    db_session.commit()

    token = create_access_token({"sub": str(doctor.id)})
    headers = {"Authorization": f"Bearer {token}"}

    # 2. GET /doctor/profile
    res = client.get("/api/v1/doctor/profile", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert data["full_name"] == "Dr. Ahmed Khan"
    assert data["tenant_slug"] == "dr-ahmed-khan"
    assert data["onboarding_completed"] is False
    assert data["services"]["appointment"] is True
    assert data["services"]["medicine_inventory"] is False

    # 3. PUT /doctor/profile (Doctor onboarding / updating practice details)
    update_payload = {
        "full_name": "Dr. Ahmed Khan, MD",
        "clinic_name": "Apex Cardiology Clinic",
        "location": "400 Medical Center Blvd, Suite 300",
        "speciality": "Cardiologist",
        "bio": "Fellow of American College of Cardiology. Specialized in preventive heart care.",
        "phone": "+1 (555) 987-6543",
        "services": {
            "appointment": True,
            "video_consultation": True,
            "medicine_inventory": True,
            "lab_reports": True,
        },
        "onboarding_completed": True,
    }
    put_res = client.put("/api/v1/doctor/profile", headers=headers, json=update_payload)
    assert put_res.status_code == 200
    put_data = put_res.json()
    assert put_data["full_name"] == "Dr. Ahmed Khan, MD"
    assert put_data["clinic_name"] == "Apex Cardiology Clinic"
    assert put_data["speciality"] == "Cardiologist"
    assert put_data["onboarding_completed"] is True
    assert put_data["services"]["medicine_inventory"] is True
    assert put_data["services"]["lab_reports"] is True

    # 4. GET /public/tenants/{slug} (Patient visits webpage)
    pub_res = client.get("/api/v1/public/tenants/dr-ahmed-khan")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["full_name"] == "Dr. Ahmed Khan, MD"
    assert pub_data["clinic_name"] == "Apex Cardiology Clinic"
    assert pub_data["location"] == "400 Medical Center Blvd, Suite 300"
    assert pub_data["speciality"] == "Cardiologist"
    assert pub_data["services"]["appointment"] is True
    assert pub_data["services"]["medicine_inventory"] is True
    assert pub_data["services"]["lab_reports"] is True

    # 5. Patient Books Appointment
    apt_res = client.post(
        "/api/v1/public/tenants/dr-ahmed-khan/appointments",
        json={
            "patient_name": "John Doe",
            "patient_email": "john@example.com",
            "patient_phone": "+1 555-111-2222",
            "appointment_date": "2026-09-10",
            "appointment_time": "10:00 AM",
            "appointment_type": "in_clinic",
            "notes": "Routine cardiovascular screening",
        },
    )
    assert apt_res.status_code == 201
    apt_data = apt_res.json()
    assert apt_data["status"] == "confirmed"
    assert apt_data["booking_id"].startswith("APT-")

    # 6. Patient Orders Medicine
    med_res = client.post(
        "/api/v1/public/tenants/dr-ahmed-khan/medicine-orders",
        json={
            "patient_name": "John Doe",
            "patient_phone": "+1 555-111-2222",
            "delivery_address": "742 Evergreen Terrace, Springfield",
            "medicines": "Atorvastatin 20mg - 30 tablets",
        },
    )
    assert med_res.status_code == 201
    med_data = med_res.json()
    assert med_data["status"] == "received"
    assert med_data["order_id"].startswith("MED-")

    # 7. Patient Uploads Lab Report
    rep_res = client.post(
        "/api/v1/public/tenants/dr-ahmed-khan/reports",
        json={
            "patient_name": "John Doe",
            "patient_phone": "+1 555-111-2222",
            "report_type": "Blood Work & Pathology",
            "file_name": "lipid_panel_results.pdf",
            "notes": "Fasting lipid panel done yesterday",
        },
    )
    assert rep_res.status_code == 201
    rep_data = rep_res.json()
    assert rep_data["status"] == "received"
    assert rep_data["report_id"].startswith("REP-")


def test_public_practice_not_found(client, db_session):
    res = client.get("/api/v1/public/tenants/unknown-doctor-slug")
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_disabled_service_rejected(client, db_session):
    # Seed doctor with medicine_inventory disabled
    doctor = Doctor(email="dr.lee@example.com", full_name="Dr. Lee", auth_provider="email")
    db_session.add(doctor)
    db_session.commit()

    tenant = Tenant(
        doctor_id=doctor.id,
        slug="dr-lee",
        status="active",
        service_appointment=True,
        service_video_consultation=True,
        service_medicine_inventory=False,
    )
    db_session.add(tenant)
    db_session.commit()

    # Attempting to order medicines should fail with 400
    res = client.post(
        "/api/v1/public/tenants/dr-lee/medicine-orders",
        json={
            "patient_name": "Jane",
            "patient_phone": "555-012345",
            "delivery_address": "123 Main St",
            "medicines": "Painkiller 500mg",
        },
    )
    assert res.status_code == 400
    assert "not active" in res.json()["detail"].lower()
