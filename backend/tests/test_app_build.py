import uuid
from app.models.doctor import Doctor
from app.models.tenant import Tenant
from app.services.app_build_service import (
    sanitize_package_segment,
    compute_app_identity,
    prepare_project_workspace,
    WORKSPACES_DIR,
)


def test_sanitize_package_segment():
    assert sanitize_package_segment("Dr. Sarah Johnson!") == "drsarahjohnson"
    assert sanitize_package_segment("123 Clinic") == "a123clinic"
    assert sanitize_package_segment("   ") == "app"
    assert sanitize_package_segment("St. Jude's Children's Hospital") == "stjudeschildrenshospital"


def test_compute_app_identity():
    doc = Doctor(
        id=uuid.uuid4(),
        email="sarah@example.com",
        full_name="Dr. Sarah Johnson",
    )
    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=doc.id,
        slug="dr-sarah-johnson",
        clinic_name="Johnson Family Health Center",
    )

    identity = compute_app_identity(doc, tenant)
    assert identity["app_name"] == "Johnson Family Health Center"
    assert identity["package_name"] == "com.docspace.drsarahjohnson.johnsonfamilyhealthcenter"


def test_prepare_project_workspace():
    doc = Doctor(
        id=uuid.uuid4(),
        email="testdoc@docspace.com",
        full_name="Dr. Test User",
        speciality="Cardiologist",
        bio="Test Bio 123",
    )
    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=doc.id,
        slug="dr-test-user",
        clinic_name="Heart Care Clinic",
        service_appointment=True,
        service_video_consultation=False,
    )

    build_id = "test_build_" + uuid.uuid4().hex[:8]
    workspace = prepare_project_workspace(build_id, doc, tenant)

    try:
        assert workspace.exists()
        
        # Check build.gradle.kts
        gradle_content = (workspace / "app" / "build.gradle.kts").read_text(encoding="utf-8")
        assert "com.docspace.drtestuser.heartcareclinic" in gradle_content
        assert "{{PACKAGE_NAME}}" not in gradle_content

        # Check strings.xml
        strings_content = (workspace / "app" / "src" / "main" / "res" / "values" / "strings.xml").read_text(encoding="utf-8")
        assert "Heart Care Clinic" in strings_content
        assert "{{APP_NAME}}" not in strings_content

        # Check DoctorConfig.kt
        config_content = (
            workspace
            / "app"
            / "src"
            / "main"
            / "kotlin"
            / "com"
            / "docspace"
            / "template"
            / "config"
            / "DoctorConfig.kt"
        ).read_text(encoding="utf-8")
        assert "Dr. Test User" in config_content
        assert "Heart Care Clinic" in config_content
        assert "Cardiologist" in config_content
        assert "Test Bio 123" in config_content
        assert "const val SERVICE_APPOINTMENT: Boolean = true" in config_content
        assert "const val SERVICE_VIDEO_CONSULTATION: Boolean = false" in config_content
        assert "{{DOCTOR_NAME}}" not in config_content

    finally:
        import shutil
        if workspace.exists():
            shutil.rmtree(workspace)


def test_app_build_routes():
    from fastapi.testclient import TestClient
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool
    from sqlalchemy.orm import sessionmaker
    from app.main import app
    from app.core.database import get_db
    from app.models.base import Base
    from app.core.security import create_access_token

    test_engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    Base.metadata.create_all(bind=test_engine)
    db = TestingSession()

    doc = Doctor(
        id=uuid.uuid4(),
        email="appdoc@example.com",
        full_name="Dr. App Builder",
        is_active=True,
    )
    db.add(doc)
    db.flush()

    tenant = Tenant(
        id=uuid.uuid4(),
        doctor_id=doc.id,
        slug="dr-app-builder",
        clinic_name="Wellness Center",
    )
    db.add(tenant)
    db.commit()

    token = create_access_token(subject=str(doc.id))

    def override_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_db

    with TestClient(app) as client:
        # Test preview
        res = client.get(
            "/api/v1/doctor/app/preview",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["app_name"] == "Wellness Center"
        assert data["package_name"] == "com.docspace.drappbuilder.wellnesscenter"

        # Test build trigger
        res_build = client.post(
            "/api/v1/doctor/app/build",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_build.status_code == 202
        build_data = res_build.json()
        assert "task_id" in build_data
        task_id = build_data["task_id"]

        # Test status
        res_status = client.get(
            f"/api/v1/doctor/app/build/{task_id}/status",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res_status.status_code == 200
        assert res_status.json()["task_id"] == task_id

