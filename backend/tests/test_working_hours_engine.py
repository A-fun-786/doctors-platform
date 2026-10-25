import os
import uuid
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from alembic.config import Config
from alembic import command

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import create_access_token
from app.core.cache import set_cached_slots, get_cached_slots
from app.main import app
from app.models.base import Base
from app.models.doctor import Doctor
from datetime import date

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


@pytest.fixture(autouse=True)
def reset_limiter():
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
def test_doctor(db_session):
    doc = Doctor(
        id=uuid.uuid4(),
        email="working_hours_doc@example.com",
        full_name="Dr. Shift Specialist",
        auth_provider="email",
        is_active=True,
    )
    db_session.add(doc)
    db_session.commit()
    db_session.refresh(doc)
    return doc


@pytest.fixture
def auth_headers(test_doctor):
    token = create_access_token(str(test_doctor.id))
    return {"Authorization": f"Bearer {token}"}


# ==============================================================================
# Phase 1 Test 1: GET /doctor/working-hours returns default shifts when unconfigured
# ==============================================================================
def test_get_working_hours_default(client, auth_headers):
    """When a doctor has no configured shifts, GET returns the 2-shift default (10-13, 16-20, Sun closed)."""
    response = client.get("/api/v1/doctor/working-hours", headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert "shifts" in data
    assert "closed_days" in data
    assert len(data["shifts"]) == 2
    assert data["shifts"][0]["id"] == "morning"
    assert data["shifts"][0]["start"] == "10:00"
    assert data["shifts"][0]["end"] == "13:00"
    assert data["shifts"][0]["enabled"] is True
    assert data["shifts"][1]["id"] == "evening"
    assert data["shifts"][1]["start"] == "16:00"
    assert data["shifts"][1]["end"] == "20:00"
    assert data["shifts"][1]["enabled"] is True
    assert data["closed_days"] == [0]


# ==============================================================================
# Phase 1 Test 2: PUT /doctor/working-hours saves valid shifts and rejects inverted ranges
# ==============================================================================
def test_put_working_hours_valid(client, auth_headers, test_doctor, db_session):
    """Valid shift configuration is stored to DB and returned."""
    payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Morning Clinic",
                "start": "09:00",
                "end": "12:30",
                "enabled": True,
            },
            {
                "id": "afternoon",
                "label": "Afternoon Rounds",
                "start": "14:00",
                "end": "18:00",
                "enabled": True,
            },
        ],
        "closed_days": [0, 6],
    }

    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert len(data["shifts"]) == 2
    assert data["shifts"][0]["start"] == "09:00"
    assert data["shifts"][0]["end"] == "12:30"
    assert data["closed_days"] == [0, 6]

    # Verify persistence in DB
    db_session.expire_all()
    reloaded_doc = db_session.query(Doctor).filter(Doctor.id == test_doctor.id).first()
    assert reloaded_doc.working_hours is not None
    assert len(reloaded_doc.working_hours["shifts"]) == 2
    assert reloaded_doc.working_hours["closed_days"] == [0, 6]


def test_put_working_hours_rejects_inverted_range(client, auth_headers):
    """Inverted ranges (start >= end) are rejected with 422."""
    payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Invalid Shift",
                "start": "14:00",
                "end": "10:00",
                "enabled": True,
            }
        ],
        "closed_days": [0],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert "strictly after start time" in response.text


def test_put_working_hours_rejects_equal_start_end(client, auth_headers):
    """Zero-duration shift (start == end) is rejected with 422."""
    payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Zero Shift",
                "start": "10:00",
                "end": "10:00",
                "enabled": True,
            }
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_put_working_hours_rejects_non_30m_intervals(client, auth_headers):
    """Shifts with non-30m boundaries (e.g. 10:15 or 12:45) are rejected with 422."""
    payload = {
        "shifts": [
            {
                "id": "morning",
                "label": "Odd minutes",
                "start": "10:15",
                "end": "13:00",
                "enabled": True,
            }
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert "30-minute intervals" in response.text


def test_put_working_hours_rejects_overlapping_enabled_shifts(client, auth_headers):
    """Overlapping active shifts are rejected with 422."""
    payload = {
        "shifts": [
            {
                "id": "shift1",
                "label": "Shift 1",
                "start": "10:00",
                "end": "13:00",
                "enabled": True,
            },
            {
                "id": "shift2",
                "label": "Shift 2",
                "start": "12:30",
                "end": "15:00",
                "enabled": True,
            },
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422
    assert "Overlapping shifts detected" in response.text


def test_put_working_hours_allows_disabled_overlap(client, auth_headers):
    """Disabled shifts do not cause overlap validation errors."""
    payload = {
        "shifts": [
            {
                "id": "shift1",
                "label": "Active Shift",
                "start": "10:00",
                "end": "13:00",
                "enabled": True,
            },
            {
                "id": "shift2",
                "label": "Inactive Draft Shift",
                "start": "12:00",
                "end": "15:00",
                "enabled": False,
            },
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 200


def test_put_working_hours_rejects_more_than_4_shifts(client, auth_headers):
    """More than 4 shifts per day is rejected with 422."""
    payload = {
        "shifts": [
            {"id": f"s{i}", "label": f"Shift {i}", "start": f"{8+i*2:02d}:00", "end": f"{9+i*2:02d}:00", "enabled": True}
            for i in range(5)
        ],
        "closed_days": [],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 422


def test_put_working_hours_invalidates_cache(client, auth_headers, test_doctor):
    """Updating working hours automatically invalidates slot cache for current doctor."""
    q_date = date(2026, 11, 1)
    set_cached_slots(test_doctor.id, q_date, [{"start": "10:00", "end": "10:30"}])
    assert get_cached_slots(test_doctor.id, q_date) is not None

    payload = {
        "shifts": [
            {"id": "m", "label": "Morning", "start": "10:00", "end": "12:00", "enabled": True}
        ],
        "closed_days": [0],
    }
    response = client.put("/api/v1/doctor/working-hours", json=payload, headers=auth_headers)
    assert response.status_code == 200
    assert get_cached_slots(test_doctor.id, q_date) is None


# ==============================================================================
# Phase 1 Test 8: Alembic migration 009 bidirectional upgrade/downgrade test
# ==============================================================================
def test_alembic_migration_009_bidirectional(tmp_path):
    """Verify migration 009 applies and rolls back cleanly."""
    db_file = tmp_path / "test_mig_009.db"
    db_url = f"sqlite:///{db_file}"

    ini_path = Path(__file__).resolve().parent.parent / "alembic.ini"
    alembic_cfg = Config(str(ini_path))
    alembic_cfg.set_main_option("script_location", str(ini_path.parent / "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # 1. Upgrade to head (009)
    command.upgrade(alembic_cfg, "head")

    # 2. Downgrade to 008
    command.downgrade(alembic_cfg, "008_add_patient_details_to_appointments")

    # 3. Re-upgrade to head (009)
    command.upgrade(alembic_cfg, "head")
