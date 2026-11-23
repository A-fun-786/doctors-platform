
from datetime import date, timedelta
from app.core.config import get_settings
from app.models.appointment import Appointment
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.core.security import create_access_token


def test_doctor_profile_flow_and_public_sync(client, db_session, monkeypatch):
    # 1. Seed doctor and tenant
    future_date = (date.today() + timedelta(days=7)).isoformat()
    while (date.today() + timedelta(days=7)).weekday() == 6:
        future_date = (date.today() + timedelta(days=8)).isoformat()
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

    token = create_access_token(str(doctor.id))
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

    # 4. GET /public/tenants/{slug} (Patient visits webpage - experimental clinical stubs hidden by default)
    pub_res = client.get("/api/v1/public/tenants/dr-ahmed-khan")
    assert pub_res.status_code == 200
    pub_data = pub_res.json()
    assert pub_data["full_name"] == "Dr. Ahmed Khan, MD"
    assert pub_data["clinic_name"] == "Apex Cardiology Clinic"
    assert pub_data["location"] == "400 Medical Center Blvd, Suite 300"
    assert pub_data["speciality"] == "Cardiologist"
    assert pub_data["services"]["appointment"] is True
    assert pub_data["services"]["medicine_inventory"] is False
    assert pub_data["services"]["lab_reports"] is False

    # 5. Real Persisted Public Patient Appointment Booking
    apt_res = client.post(
        "/api/v1/public/tenants/dr-ahmed-khan/appointments",
        headers={"Idempotency-Key": "test-public-booking-key-1"},
        json={
            "patient_name": "John Doe",
            "patient_email": "john@example.com",
            "patient_phone": "+1 555-111-2222",
            "appointment_date": future_date,
            "appointment_time": "10:00 AM",
            "start_time": "10:00",
            "end_time": "10:30",
            "appointment_type": "in_clinic",
            "notes": "Routine cardiovascular screening",
        },
    )
    assert apt_res.status_code == 201
    apt_data = apt_res.json()
    assert apt_data["booking_id"].startswith("APT-")
    assert apt_data["status"] == "BOOKED"
    persisted = db_session.query(Appointment).filter(Appointment.doctor_id == doctor.id).first()
    assert persisted is not None
    assert persisted.patient_name == "John Doe"

    # Duplicate slot booking without same idempotency key returns 409 Conflict
    dup_res = client.post(
        "/api/v1/public/tenants/dr-ahmed-khan/appointments",
        json={
            "patient_name": "Another Patient",
            "patient_email": "other@example.com",
            "patient_phone": "+1 555-333-4444",
            "appointment_date": future_date,
            "appointment_time": "10:00 AM",
            "appointment_type": "in_clinic",
        },
    )
    assert dup_res.status_code == 409

    # 6. Experimental clinical stubs return 501 Not Implemented by default in production posture
    med_disabled_res = client.post(
        "/api/v1/public/tenants/dr-ahmed-khan/medicine-orders",
        json={
            "patient_name": "John Doe",
            "patient_phone": "+1 555-111-2222",
            "delivery_address": "742 Evergreen Terrace, Springfield",
            "medicines": "Atorvastatin 20mg - 30 tablets",
        },
    )
    assert med_disabled_res.status_code == 501

    rep_disabled_res = client.post(
        "/api/v1/public/tenants/dr-ahmed-khan/reports",
        json={
            "patient_name": "John Doe",
            "patient_phone": "+1 555-111-2222",
            "report_type": "Blood Work & Pathology",
            "file_name": "lipid_panel_results.pdf",
            "notes": "Fasting lipid panel done yesterday",
        },
    )
    assert rep_disabled_res.status_code == 501

    # 7. When experimental flag is explicitly enabled, medicine orders & lab reports succeed
    monkeypatch.setattr(get_settings(), "ENABLE_EXPERIMENTAL_CLINICAL_SERVICES", True)
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
