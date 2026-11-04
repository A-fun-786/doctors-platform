import uuid
from datetime import date, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import get_db
from app.core.security import create_access_token
from app.main import app
from app.models.base import Base
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.models.pharmacy import MedicineItem, MedicineOrder

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


@pytest.fixture
def test_doctor(db_session):
    doc = Doctor(
        id=uuid.uuid4(),
        email="pharmacydoctor@example.com",
        full_name="Dr. Pharma Spec",
        is_active=True,
    )
    db_session.add(doc)
    db_session.flush()

    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=doc.id,
        slug="dr-pharma",
        clinic_name="Pharma Wellness Clinic",
        service_medicine_inventory=True,
        status="active",
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@pytest.fixture
def auth_headers(test_doctor):
    token = create_access_token(subject=str(test_doctor.id))
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def second_doctor(db_session):
    doc = Doctor(
        id=uuid.uuid4(),
        email="otherdoc@example.com",
        full_name="Dr. Other",
        is_active=True,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@pytest.fixture
def second_auth_headers(second_doctor):
    token = create_access_token(subject=str(second_doctor.id))
    return {"Authorization": f"Bearer {token}"}


def test_create_and_get_medicine(client, auth_headers):
    payload = {
        "name": "Amoxicillin 500mg",
        "generic_name": "Amoxicillin Trihydrate",
        "category": "Antibiotics",
        "dosage_form": "Capsule",
        "strength": "500 mg",
        "sku": "AMX-500",
        "batch_number": "B-9001",
        "stock_quantity": 50,
        "min_stock_alert": 10,
        "unit_price": 14.50,
        "expiry_date": (date.today() + timedelta(days=200)).isoformat(),
        "manufacturer": "GSK",
        "description": "Bacterial infection antibiotic",
    }
    res = client.post("/api/v1/doctor/pharmacy/medicines", json=payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    assert data["name"] == "Amoxicillin 500mg"
    assert data["stock_quantity"] == 50
    assert data["status"] == "in_stock"
    assert data["is_expiring_soon"] is False
    assert data["is_expired"] is False
    item_id = data["id"]

    get_res = client.get(f"/api/v1/doctor/pharmacy/medicines/{item_id}", headers=auth_headers)
    assert get_res.status_code == 200
    assert get_res.json()["sku"] == "AMX-500"


def test_stock_status_calculation(client, auth_headers):
    # In stock
    p1 = {
        "name": "Med Good Stock",
        "stock_quantity": 50,
        "min_stock_alert": 10,
    }
    r1 = client.post("/api/v1/doctor/pharmacy/medicines", json=p1, headers=auth_headers)
    assert r1.status_code == 201
    assert r1.json()["status"] == "in_stock"

    # Low stock
    p2 = {
        "name": "Med Low Stock",
        "stock_quantity": 5,
        "min_stock_alert": 10,
    }
    r2 = client.post("/api/v1/doctor/pharmacy/medicines", json=p2, headers=auth_headers)
    assert r2.status_code == 201
    assert r2.json()["status"] == "low_stock"

    # Out of stock
    p3 = {
        "name": "Med Out Of Stock",
        "stock_quantity": 0,
        "min_stock_alert": 10,
    }
    r3 = client.post("/api/v1/doctor/pharmacy/medicines", json=p3, headers=auth_headers)
    assert r3.status_code == 201
    assert r3.json()["status"] == "out_of_stock"


def test_stock_adjustment_and_boundary(client, auth_headers):
    p = {"name": "Aspirin 100mg", "stock_quantity": 20, "min_stock_alert": 5}
    res = client.post("/api/v1/doctor/pharmacy/medicines", json=p, headers=auth_headers)
    item_id = res.json()["id"]

    # Increase stock +15
    adj_res = client.post(
        f"/api/v1/doctor/pharmacy/medicines/{item_id}/adjust-stock",
        json={"adjustment": 15},
        headers=auth_headers,
    )
    assert adj_res.status_code == 200
    assert adj_res.json()["stock_quantity"] == 35

    # Decrease stock -30 -> quantity becomes 5 (low stock)
    adj_res2 = client.post(
        f"/api/v1/doctor/pharmacy/medicines/{item_id}/adjust-stock",
        json={"adjustment": -30},
        headers=auth_headers,
    )
    assert adj_res2.status_code == 200
    assert adj_res2.json()["stock_quantity"] == 5
    assert adj_res2.json()["status"] == "low_stock"

    # Attempt to deduct more than current stock (-10 when stock is 5) -> 400 error
    adj_fail = client.post(
        f"/api/v1/doctor/pharmacy/medicines/{item_id}/adjust-stock",
        json={"adjustment": -10},
        headers=auth_headers,
    )
    assert adj_fail.status_code == 400
    assert "Cannot reduce stock" in adj_fail.json()["detail"]


def test_delete_and_update_medicine(client, auth_headers):
    p = {"name": "Ibuprofen 400mg", "stock_quantity": 100}
    res = client.post("/api/v1/doctor/pharmacy/medicines", json=p, headers=auth_headers)
    item_id = res.json()["id"]

    # Update price and name
    up_res = client.put(
        f"/api/v1/doctor/pharmacy/medicines/{item_id}",
        json={"name": "Ibuprofen 600mg", "unit_price": 9.99},
        headers=auth_headers,
    )
    assert up_res.status_code == 200
    assert up_res.json()["name"] == "Ibuprofen 600mg"
    assert up_res.json()["unit_price"] == 9.99

    # Delete
    del_res = client.delete(f"/api/v1/doctor/pharmacy/medicines/{item_id}", headers=auth_headers)
    assert del_res.status_code == 204

    # Fetch after delete -> 404
    get_res = client.get(f"/api/v1/doctor/pharmacy/medicines/{item_id}", headers=auth_headers)
    assert get_res.status_code == 404


def test_doctor_isolation(client, auth_headers, second_auth_headers):
    # Doctor 1 creates medicine
    p = {"name": "Doctor 1 Secret Medicine", "stock_quantity": 10}
    res1 = client.post("/api/v1/doctor/pharmacy/medicines", json=p, headers=auth_headers)
    item_id = res1.json()["id"]

    # Doctor 2 cannot view Doctor 1's medicine
    res2 = client.get(f"/api/v1/doctor/pharmacy/medicines/{item_id}", headers=second_auth_headers)
    assert res2.status_code == 404

    # Doctor 2 list returns 0 items
    list_res = client.get("/api/v1/doctor/pharmacy/medicines", headers=second_auth_headers)
    assert list_res.status_code == 200
    assert list_res.json()["total"] == 0


def test_seed_sample_medicines(client, auth_headers):
    # Call seed
    seed_res = client.post("/api/v1/doctor/pharmacy/seed-samples", headers=auth_headers)
    assert seed_res.status_code == 200
    data = seed_res.json()
    assert data["total"] >= 5

    # Call stats
    stats_res = client.get("/api/v1/doctor/pharmacy/stats", headers=auth_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_medicines"] >= 5
    assert stats["low_stock_count"] >= 1
    assert stats["out_of_stock_count"] >= 1
    assert stats["expiring_soon_count"] >= 1


def test_public_order_lifecycle(client, auth_headers):
    # Public patient submits order
    order_payload = {
        "patient_name": "Jane Doe",
        "patient_phone": "+15551234567",
        "delivery_address": "742 Evergreen Terrace, Apt 4B",
        "medicines": "Amoxicillin 500mg - 20 capsules\nParacetamol 650mg - 1 strip",
    }
    pub_res = client.post("/api/v1/public/tenants/dr-pharma/medicine-orders", json=order_payload)
    assert pub_res.status_code == 201
    order_id_code = pub_res.json()["order_id"]
    assert order_id_code.startswith("MED-")

    # Doctor views orders
    orders_res = client.get("/api/v1/doctor/pharmacy/orders", headers=auth_headers)
    assert orders_res.status_code == 200
    orders = orders_res.json()["orders"]
    assert len(orders) == 1
    order_id = orders[0]["id"]
    assert orders[0]["patient_name"] == "Jane Doe"
    assert orders[0]["status"] == "received"

    # Doctor transitions status to processing
    up_res = client.patch(
        f"/api/v1/doctor/pharmacy/orders/{order_id}/status",
        json={"status": "processing", "doctor_notes": "Prescription verified with clinic chart."},
        headers=auth_headers,
    )
    assert up_res.status_code == 200
    assert up_res.json()["status"] == "processing"
    assert up_res.json()["doctor_notes"] == "Prescription verified with clinic chart."

    # Doctor completes order with total price
    comp_res = client.patch(
        f"/api/v1/doctor/pharmacy/orders/{order_id}/status",
        json={"status": "completed", "total_price": 28.50, "doctor_notes": "Dispatched via local clinic courier."},
        headers=auth_headers,
    )
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"
    assert comp_res.json()["total_price"] == 28.50
