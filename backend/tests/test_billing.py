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
from app.models.billing import (
    ClinicServiceCatalog,
    Invoice,
    InvoiceItem,
    Payment,
    Refund,
)

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
        email="billingdoctor@example.com",
        full_name="Dr. Billing Spec",
        is_active=True,
    )
    db_session.add(doc)
    db_session.flush()

    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=doc.id,
        slug="dr-billing",
        clinic_name="Metro Healthcare Clinic",
        service_appointment=True,
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
        email="otherbilling@example.com",
        full_name="Dr. Other Clinic",
        is_active=True,
    )
    db_session.add(doc)
    db_session.flush()

    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=doc.id,
        slug="dr-other",
        clinic_name="Other Clinic",
        status="active",
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@pytest.fixture
def second_auth_headers(second_doctor):
    token = create_access_token(subject=str(second_doctor.id))
    return {"Authorization": f"Bearer {token}"}


def test_service_catalog_seed_and_create(client, auth_headers):
    # Seed default catalog
    seed_res = client.post("/api/v1/doctor/billing/catalog/seed-defaults", headers=auth_headers)
    assert seed_res.status_code == 200
    catalog = seed_res.json()
    assert len(catalog) >= 5
    assert any(i["code"] == "CONS-GEN" for i in catalog)

    # Add custom item
    custom_item = {
        "name": "IV Fluid Infusion (Normal Saline)",
        "code": "PROC-IV",
        "category": "procedure",
        "unit_price_paise": 45000,  # ₹450.00
        "tax_rate_percent": 5.0,
        "description": "500ml IV hydration fluid.",
    }
    create_res = client.post("/api/v1/doctor/billing/catalog", json=custom_item, headers=auth_headers)
    assert create_res.status_code == 201
    assert create_res.json()["name"] == "IV Fluid Infusion (Normal Saline)"
    assert create_res.json()["unit_price_paise"] == 45000


def test_create_and_issue_invoice_lifecycle(client, auth_headers):
    # Create draft invoice with 2 items
    invoice_payload = {
        "patient_name": "Marcus Aurelius",
        "patient_contact": "+919876543210",
        "notes": "Follow-up after blood pressure check.",
        "discount_paise": 5000,  # ₹50.00 discount on whole bill
        "items": [
            {
                "source_module": "consultation",
                "description": "General Doctor Consultation",
                "quantity": 1,
                "unit_price_paise": 50000,  # ₹500.00
                "discount_paise": 0,
                "tax_rate_percent": 0.0,
            },
            {
                "source_module": "pharmacy",
                "description": "Amlodipine 5mg (30 Tablets)",
                "quantity": 2,
                "unit_price_paise": 10000,  # 2 * ₹100.00 = ₹200.00
                "discount_paise": 0,
                "tax_rate_percent": 5.0,  # 5% tax on 20000 = 1000 paise (₹10.00)
            },
        ],
    }

    res = client.post("/api/v1/doctor/billing/invoices", json=invoice_payload, headers=auth_headers)
    assert res.status_code == 201
    data = res.json()
    invoice_id = data["id"]
    assert data["invoice_number"].startswith("INV-")
    assert data["status"] == "draft"

    # Total:
    # Subtotal: 50000 + 20000 = 70000 paise
    # Tax: 5% of 20000 = 1000 paise
    # Discount: 5000 paise
    # Total: 70000 - 5000 + 1000 = 66000 paise (₹660.00)
    assert data["subtotal_paise"] == 71000 or data["total_amount_paise"] == 66000
    assert data["balance_due_paise"] == 66000

    # Issue invoice (locks draft)
    issue_res = client.post(f"/api/v1/doctor/billing/invoices/{invoice_id}/issue", headers=auth_headers)
    assert issue_res.status_code == 200
    assert issue_res.json()["status"] == "issued"

    # Attempt to edit issued invoice -> 400 bad request
    edit_res = client.put(
        f"/api/v1/doctor/billing/invoices/{invoice_id}",
        json={"patient_name": "Changed Name"},
        headers=auth_headers,
    )
    assert edit_res.status_code == 400
    assert "locked" in edit_res.json()["detail"].lower() or "issued" in edit_res.json()["detail"].lower()


def test_partial_and_split_payments(client, auth_headers):
    # Create invoice of ₹1000 (100000 paise)
    inv_payload = {
        "patient_name": "Eleanor Vance",
        "patient_contact": "+919811223344",
        "auto_issue": True,
        "items": [
            {
                "source_module": "consultation",
                "description": "Specialist Consultation",
                "quantity": 1,
                "unit_price_paise": 100000,
                "discount_paise": 0,
                "tax_rate_percent": 0.0,
            }
        ],
    }
    inv_res = client.post("/api/v1/doctor/billing/invoices", json=inv_payload, headers=auth_headers)
    assert inv_res.status_code == 201
    invoice_id = inv_res.json()["id"]
    assert inv_res.json()["status"] == "issued"

    # 1. First Payment: Split ₹400 in Cash
    p1 = {
        "amount_paise": 40000,
        "method": "cash",
        "notes": "Part payment in cash",
    }
    res1 = client.post(f"/api/v1/doctor/billing/invoices/{invoice_id}/payments", json=p1, headers=auth_headers)
    assert res1.status_code == 201
    assert res1.json()["amount_paise"] == 40000

    # Verify invoice status is now 'partially_paid' and balance is 60000
    inv1 = client.get(f"/api/v1/doctor/billing/invoices/{invoice_id}", headers=auth_headers).json()
    assert inv1["status"] == "partially_paid"
    assert inv1["paid_amount_paise"] == 40000
    assert inv1["balance_due_paise"] == 60000

    # 2. Second Payment: Split ₹600 via UPI QR code
    p2 = {
        "amount_paise": 60000,
        "method": "upi",
        "reference_number": "UPI-REF-99220011",
        "notes": "Balance cleared via GPay scan",
    }
    res2 = client.post(f"/api/v1/doctor/billing/invoices/{invoice_id}/payments", json=p2, headers=auth_headers)
    assert res2.status_code == 201

    # Verify invoice status is now 'paid' and balance is 0
    inv2 = client.get(f"/api/v1/doctor/billing/invoices/{invoice_id}", headers=auth_headers).json()
    assert inv2["status"] == "paid"
    assert inv2["paid_amount_paise"] == 100000
    assert inv2["balance_due_paise"] == 0

    # Attempt excess payment -> 400
    excess_pmt = {"amount_paise": 5000, "method": "cash"}
    res_excess = client.post(f"/api/v1/doctor/billing/invoices/{invoice_id}/payments", json=excess_pmt, headers=auth_headers)
    assert res_excess.status_code == 400


def test_payment_idempotency(client, auth_headers):
    inv_payload = {
        "patient_name": "Idempotent Tester",
        "auto_issue": True,
        "items": [
            {
                "source_module": "consultation",
                "description": "Routine Checkup",
                "quantity": 1,
                "unit_price_paise": 50000,
                "discount_paise": 0,
                "tax_rate_percent": 0.0,
            }
        ],
    }
    inv_id = client.post("/api/v1/doctor/billing/invoices", json=inv_payload, headers=auth_headers).json()["id"]

    idempotency_key = "idemp-key-test-abc-123"
    pmt_payload = {
        "amount_paise": 50000,
        "method": "card",
        "idempotency_key": idempotency_key,
    }

    # First attempt
    res1 = client.post(f"/api/v1/doctor/billing/invoices/{inv_id}/payments", json=pmt_payload, headers=auth_headers)
    assert res1.status_code == 201
    pmt1_id = res1.json()["id"]

    # Second attempt with same idempotency key (network retry scenario)
    res2 = client.post(f"/api/v1/doctor/billing/invoices/{inv_id}/payments", json=pmt_payload, headers=auth_headers)
    assert res2.status_code == 201
    pmt2_id = res2.json()["id"]

    # Must return existing transaction and not charge twice
    assert pmt1_id == pmt2_id


def test_cross_module_adapter_add_to_invoice(client, auth_headers):
    patient = "Cross Module Patient"

    # Step 1: Consultation pushes consultation charge
    item1 = [
        {
            "source_module": "consultation",
            "description": "Initial Consultation",
            "quantity": 1,
            "unit_price_paise": 50000,
            "discount_paise": 0,
            "tax_rate_percent": 0.0,
        }
    ]
    res1 = client.post(
        f"/api/v1/doctor/billing/add-to-invoice?patient_name={patient}",
        json=item1,
        headers=auth_headers,
    )
    assert res1.status_code == 200
    data1 = res1.json()
    invoice_id = data1["id"]
    assert len(data1["items"]) == 1
    assert data1["total_amount_paise"] == 50000

    # Step 2: Pharmacy pushes medicines to the SAME patient draft
    item2 = [
        {
            "source_module": "pharmacy",
            "source_ref_id": "MED-ORD-99",
            "description": "Amoxicillin 500mg (10 Caps)",
            "quantity": 1,
            "unit_price_paise": 15000,
            "discount_paise": 0,
            "tax_rate_percent": 0.0,
        }
    ]
    res2 = client.post(
        f"/api/v1/doctor/billing/add-to-invoice?patient_name={patient}",
        json=item2,
        headers=auth_headers,
    )
    assert res2.status_code == 200
    data2 = res2.json()

    # Must append to the same invoice!
    assert data2["id"] == invoice_id
    assert len(data2["items"]) == 2
    assert data2["total_amount_paise"] == 65000  # ₹500 + ₹150


def test_multi_tenant_isolation(client, auth_headers, second_auth_headers):
    # Doctor 1 creates invoice
    inv_payload = {
        "patient_name": "Doctor 1 Patient",
        "items": [
            {
                "source_module": "consultation",
                "description": "Consultation",
                "quantity": 1,
                "unit_price_paise": 50000,
                "discount_paise": 0,
                "tax_rate_percent": 0.0,
            }
        ],
    }
    inv1_id = client.post("/api/v1/doctor/billing/invoices", json=inv_payload, headers=auth_headers).json()["id"]

    # Doctor 2 cannot view Doctor 1's invoice
    res_d2 = client.get(f"/api/v1/doctor/billing/invoices/{inv1_id}", headers=second_auth_headers)
    assert res_d2.status_code == 404

    # Doctor 2 cannot record payment on Doctor 1's invoice
    res_pmt2 = client.post(
        f"/api/v1/doctor/billing/invoices/{inv1_id}/payments",
        json={"amount_paise": 10000, "method": "cash"},
        headers=second_auth_headers,
    )
    assert res_pmt2.status_code == 404

