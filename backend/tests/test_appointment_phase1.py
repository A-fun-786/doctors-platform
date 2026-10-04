import uuid
from datetime import date, time, timedelta
import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from alembic.config import Config
from alembic import command

from app.models.base import Base
from app.models.doctor import Doctor
from app.models.schedule import Schedule
from app.models.appointment import Appointment
from app.schemas.schedule import ScheduleCreateRequest, ScheduleResponse
from app.schemas.appointment import AppointmentCreateRequest, AppointmentResponse
from app.core.database import engine as app_engine


# In-memory database fixture for model testing
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=test_engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=test_engine)


def test_models_and_relationships(db):
    """Verify Schedule and Appointment models, relationships with Doctor, and TimestampMixin."""
    doctor = Doctor(
        email=f"doc-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Dr. Gregory House",
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    # Add schedule entry
    schedule = Schedule(
        doctor_id=doctor.id,
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(13, 0),
        type="AVAILABLE",
    )
    # Add appointment
    appointment = Appointment(
        doctor_id=doctor.id,
        patient_name="John Doe",
        patient_contact="john@example.com",
        date=date(2026, 10, 12),
        start_time=time(9, 30),
        end_time=time(10, 0),
        status="BOOKED",
    )
    db.add_all([schedule, appointment])
    db.commit()

    db.refresh(doctor)
    assert len(doctor.schedules) == 1
    assert doctor.schedules[0].type == "AVAILABLE"
    assert doctor.schedules[0].created_at is not None

    assert len(doctor.appointments) == 1
    assert doctor.appointments[0].patient_name == "John Doe"
    assert doctor.appointments[0].created_at is not None


def test_appointment_unique_slot_constraint(db):
    """Verify uq_doctor_appointment_slot prevents double booking the same slot."""
    doctor = Doctor(
        email=f"doc-{uuid.uuid4().hex[:6]}@example.com",
        full_name="Dr. James Wilson",
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)

    app1 = Appointment(
        doctor_id=doctor.id,
        patient_name="Patient 1",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
    )
    db.add(app1)
    db.commit()

    # Attempt second appointment for same doctor, date, start_time
    app2 = Appointment(
        doctor_id=doctor.id,
        patient_name="Patient 2",
        date=date(2026, 10, 12),
        start_time=time(10, 0),
        end_time=time(10, 30),
    )
    db.add(app2)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_schedule_and_appointment_schemas():
    """Verify validation rules in Schedule and Appointment Pydantic schemas."""
    # Valid schedule
    valid_sched = ScheduleCreateRequest(
        date=date(2026, 10, 12),
        start_time=time(9, 0),
        end_time=time(12, 0),
        type="AVAILABLE",
    )
    assert valid_sched.type == "AVAILABLE"

    # Invalid schedule type
    with pytest.raises(ValidationError):
        ScheduleCreateRequest(
            date=date(2026, 10, 12),
            start_time=time(9, 0),
            end_time=time(12, 0),
            type="INVALID_TYPE",
        )

    # Invalid time order (end before start)
    with pytest.raises(ValidationError):
        ScheduleCreateRequest(
            date=date(2026, 10, 12),
            start_time=time(14, 0),
            end_time=time(10, 0),
            type="AVAILABLE",
        )

    # Missing required patient_name
    with pytest.raises(ValidationError):
        AppointmentCreateRequest(
            date=date(2026, 10, 12),
            start_time=time(9, 0),
            end_time=time(9, 30),
        )


def test_database_pool_settings():
    """Verify Neon connection pool hardening parameters."""
    pool = app_engine.pool
    assert pool.size() == 3
    assert pool._max_overflow == 5
    assert pool._recycle == 300


def test_migration_006_upgrade_downgrade(tmp_path):
    """Verify migration 006 applies and rolls back cleanly."""
    db_file = tmp_path / "test_mig.db"
    db_url = f"sqlite:///{db_file}"

    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", db_url)

    # Upgrade to head (006)
    command.upgrade(alembic_cfg, "head")

    # Downgrade to 005
    command.downgrade(alembic_cfg, "005_alter_avatar_url_to_text")

    # Re-upgrade to head
    command.upgrade(alembic_cfg, "head")
