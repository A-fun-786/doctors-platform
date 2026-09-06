import os
import shutil
import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_doctor
from app.core.database import get_db
from app.models.doctor import Doctor
from app.services.app_build_service import (
    trigger_app_build,
    get_build_status,
    get_build_logs,
    get_latest_doctor_apk,
    compute_app_identity,
    WORKSPACE_ROOT,
)

router = APIRouter(prefix="/doctor/app", tags=["doctor-app"])

UPLOAD_ICONS_DIR = WORKSPACE_ROOT / "backend" / "uploads" / "icons"


@router.get("/preview")
def get_app_preview(
    current_doctor: Doctor = Depends(get_current_doctor),
):
    """Retrieve app branding preview and latest built APK info if available."""
    tenant = current_doctor.tenant
    identity = compute_app_identity(current_doctor, tenant)
    latest_apk = get_latest_doctor_apk(current_doctor, tenant)
    return {
        "app_name": identity["app_name"],
        "package_name": identity["package_name"],
        "has_custom_icon": bool(current_doctor.app_icon_url),
        "app_icon_url": current_doctor.app_icon_url,
        "latest_apk": latest_apk,
    }


@router.post("/icon")
def upload_app_icon(
    file: UploadFile = File(...),
    current_doctor: Doctor = Depends(get_current_doctor),
    db: Session = Depends(get_db),
):
    """Upload a custom 512x512 app launcher icon for the doctor's Android app."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must be a valid image (PNG or JPG).",
        )

    UPLOAD_ICONS_DIR.mkdir(parents=True, exist_ok=True)
    ext = Path(file.filename or "icon.png").suffix or ".png"
    filename = f"icon_{current_doctor.id}_{uuid.uuid4().hex[:6]}{ext}"
    icon_path = UPLOAD_ICONS_DIR / filename

    with open(icon_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Update doctor record
    current_doctor.app_icon_url = str(icon_path)
    db.commit()
    db.refresh(current_doctor)

    return {
        "message": "Custom app icon successfully uploaded.",
        "icon_filename": filename,
        "app_icon_url": str(icon_path),
    }


@router.post("/build", status_code=status.HTTP_202_ACCEPTED)
def start_app_build(
    current_doctor: Doctor = Depends(get_current_doctor),
):
    """Trigger background build of the doctor's personalized Jetpack Compose Android app."""
    tenant = current_doctor.tenant
    task_info = trigger_app_build(
        doctor=current_doctor,
        tenant=tenant,
        custom_icon_path=current_doctor.app_icon_url,
    )
    return {
        "message": "Build started successfully.",
        "task_id": task_info["task_id"],
        "status": task_info["status"],
        "app_name": task_info["app_name"],
        "package_name": task_info["package_name"],
    }


@router.get("/build/{task_id}/status")
def check_build_status(
    task_id: str,
    current_doctor: Doctor = Depends(get_current_doctor),
):
    """Poll the status and progress of an active APK build."""
    task_info = get_build_status(task_id)
    if not task_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Build task '{task_id}' not found.",
        )
    return task_info


@router.get("/build/{task_id}/logs")
def check_build_logs(
    task_id: str,
    current_doctor: Doctor = Depends(get_current_doctor),
):
    """Retrieve full compilation log output for an APK build."""
    return {"task_id": task_id, "logs": get_build_logs(task_id)}


@router.get("/download/{task_id}")
def download_app_apk(
    task_id: str,
):
    """Download the generated .apk file once the build is completed.
    Permits direct downloads so doctors and their patients can sideload via link or QR code.
    """
    task_info = get_build_status(task_id)
    if not task_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Build task '{task_id}' not found.",
        )

    if task_info["status"] != "completed" or not task_info.get("apk_path"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Build is currently '{task_info['status']}'. APK is not ready for download.",
        )

    apk_path = Path(task_info["apk_path"])
    if not apk_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="APK file is missing from build storage.",
        )

    filename = task_info.get("apk_filename") or f"DocSpace_{task_id[:8]}.apk"
    return FileResponse(
        path=str(apk_path),
        filename=filename,
        media_type="application/vnd.android.package-archive",
    )

