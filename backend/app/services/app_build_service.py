import os
import re
import shutil
import subprocess
import threading
import uuid
from pathlib import Path
from typing import Dict, Any, Optional

from app.models.doctor import Doctor
from app.models.tenant import Tenant

# Root of the workspace
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent.parent.parent
TEMPLATE_DIR = WORKSPACE_ROOT / "android-template"
BUILDS_DIR = WORKSPACE_ROOT / "backend" / "builds"
APKS_DIR = BUILDS_DIR / "apks"
WORKSPACES_DIR = BUILDS_DIR / "workspaces"
LOGS_DIR = BUILDS_DIR / "logs"

# In-memory build status cache: {task_id: {"status": "...", "progress": 0, "app_name": "...", "package_name": "...", "apk_path": "...", "error": None}}
_BUILD_TASKS: Dict[str, Dict[str, Any]] = {}
_LOCK = threading.Lock()


def sanitize_package_segment(name: str, fallback: str = "app") -> str:
    """Sanitize arbitrary strings into valid Android package name segments."""
    cleaned = re.sub(r"[^a-zA-Z0-9_]", "", name.lower())
    if not cleaned:
        return fallback
    # Segment must not start with a digit
    if cleaned[0].isdigit():
        cleaned = f"a{cleaned}"
    return cleaned


def compute_app_identity(doctor: Doctor, tenant: Optional[Tenant]) -> Dict[str, str]:
    """Compute unique app name and package name according to project rules:
    App Name: Clinic Name (or Doctor Name Clinic)
    Package Name: com.docspace.{doctorname}.{clinicname}
    """
    clean_doctor = sanitize_package_segment(doctor.full_name, fallback="doctor")
    clinic_candidate = (tenant.clinic_name if tenant and tenant.clinic_name else "").strip()
    clean_clinic = sanitize_package_segment(clinic_candidate, fallback="clinic")

    app_name = clinic_candidate if clinic_candidate else f"{doctor.full_name}'s Clinic"
    package_name = f"com.docspace.{clean_doctor}.{clean_clinic}"

    return {
        "app_name": app_name,
        "package_name": package_name,
        "doctor_segment": clean_doctor,
        "clinic_segment": clean_clinic,
    }


def prepare_project_workspace(
    build_id: str,
    doctor: Doctor,
    tenant: Optional[Tenant],
    custom_icon_path: Optional[str] = None,
) -> Path:
    """Clone the template into a separate isolated workspace and inject doctor configurations."""
    identity = compute_app_identity(doctor, tenant)
    target_workspace = WORKSPACES_DIR / build_id

    if target_workspace.exists():
        shutil.rmtree(target_workspace)

    # 1. Copy android-template into isolated build workspace
    shutil.copytree(TEMPLATE_DIR, target_workspace)

    # 2. Inject values into app/build.gradle.kts
    app_gradle_file = target_workspace / "app" / "build.gradle.kts"
    if app_gradle_file.exists():
        content = app_gradle_file.read_text(encoding="utf-8")
        content = content.replace("{{PACKAGE_NAME}}", identity["package_name"])
        app_gradle_file.write_text(content, encoding="utf-8")

    # 3. Inject app_name into strings.xml
    strings_file = target_workspace / "app" / "src" / "main" / "res" / "values" / "strings.xml"
    if strings_file.exists():
        content = strings_file.read_text(encoding="utf-8")
        safe_app_name = (
            identity["app_name"]
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("'", "\\'")
            .replace('"', '\\"')
        )
        content = content.replace("{{APP_NAME}}", safe_app_name)
        strings_file.write_text(content, encoding="utf-8")

    # 4. Inject DoctorConfig.kt
    config_file = (
        target_workspace
        / "app"
        / "src"
        / "main"
        / "kotlin"
        / "com"
        / "docspace"
        / "template"
        / "config"
        / "DoctorConfig.kt"
    )
    if config_file.exists():
        content = config_file.read_text(encoding="utf-8")

        def _escape_kotlin(s: Optional[str]) -> str:
            if not s:
                return ""
            return s.replace("\\", "\\\\").replace('"', '\\"')

        services = tenant if tenant else None
        replacements = {
            "{{DOCTOR_NAME}}": _escape_kotlin(doctor.full_name),
            "{{CLINIC_NAME}}": _escape_kotlin(tenant.clinic_name if tenant else ""),
            "{{SPECIALITY}}": _escape_kotlin(doctor.speciality or "Healthcare Practitioner"),
            "{{BIO}}": (doctor.bio or "").replace('"""', '\"\"\"'),
            "{{LOCATION}}": _escape_kotlin(tenant.location if tenant else ""),
            "{{AVATAR_URL}}": _escape_kotlin(doctor.avatar_url or ""),
            "{{PHONE}}": _escape_kotlin(doctor.phone or ""),
            "{{EMAIL}}": _escape_kotlin(doctor.email or ""),
            "{{SLUG}}": _escape_kotlin(tenant.slug if tenant else ""),
            "{{SERVICE_APPOINTMENT}}": "true" if (services and services.service_appointment) else "false",
            "{{SERVICE_VIDEO_CONSULTATION}}": "true" if (services and services.service_video_consultation) else "false",
            "{{SERVICE_MEDICINE_INVENTORY}}": "true" if (services and services.service_medicine_inventory) else "false",
            "{{SERVICE_LAB_REPORTS}}": "true" if (services and services.service_lab_reports) else "false",
        }

        for placeholder, value in replacements.items():
            content = content.replace(placeholder, value)

        config_file.write_text(content, encoding="utf-8")

    # 5. Handle Custom App Icon if available
    icon_to_use = custom_icon_path or doctor.app_icon_url
    if icon_to_use and Path(icon_to_use).exists():
        try:
            # Copy to drawable or replace mipmaps
            dest_icon = target_workspace / "app" / "src" / "main" / "res" / "drawable" / "custom_icon.png"
            shutil.copy2(icon_to_use, dest_icon)
        except Exception as e:
            print(f"Warning: Could not copy custom icon: {e}")

    return target_workspace


def run_gradle_build(build_id: str, workspace_path: Path, identity: Dict[str, str]):
    """Execute Gradle assembleRelease in a background thread and track status."""
    log_file_path = LOGS_DIR / f"{build_id}.log"
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    try:
        with _LOCK:
            if build_id not in _BUILD_TASKS:
                _BUILD_TASKS[build_id] = {"task_id": build_id}
            _BUILD_TASKS[build_id]["status"] = "compiling"
            _BUILD_TASKS[build_id]["progress"] = 35

        # Ensure gradlew has executable permissions
        gradlew = workspace_path / "gradlew"
        if gradlew.exists():
            os.chmod(gradlew, 0o755)

        # Look for Android SDK & Java Home
        env = os.environ.copy()
        candidate_sdk = Path.home() / "Library" / "Android" / "sdk"
        if "ANDROID_HOME" not in env:
            if candidate_sdk.exists():
                env["ANDROID_HOME"] = str(candidate_sdk)

        sdk_dir_val = env.get("ANDROID_HOME", str(candidate_sdk))
        local_props = workspace_path / "local.properties"
        local_props.write_text(f"sdk.dir={sdk_dir_val}\n", encoding="utf-8")

        # Check Android Studio bundled Java if standard JAVA_HOME is not set
        if "JAVA_HOME" not in env or not Path(env["JAVA_HOME"]).exists():
            candidate_jbr = Path("/Applications/Android Studio.app/Contents/jbr/Contents/Home")
            if candidate_jbr.exists():
                env["JAVA_HOME"] = str(candidate_jbr)
                env["PATH"] = f"{candidate_jbr}/bin:{env.get('PATH', '')}"

        # Execute build command streaming to log file
        cmd = ["./gradlew", "assembleRelease", "--no-daemon", "--stacktrace"]
        with open(log_file_path, "w", encoding="utf-8") as log_f:
            log_f.write(f"=== DocSpace Build Engine v1.0 ===\n")
            log_f.write(f"Target App: {identity['app_name']}\n")
            log_f.write(f"Package: {identity['package_name']}\n")
            log_f.write(f"JAVA_HOME: {env.get('JAVA_HOME', 'default')}\n")
            log_f.write(f"ANDROID_HOME: {sdk_dir_val}\n")
            log_f.write(f"Command: {' '.join(cmd)}\n\n")
            log_f.flush()

            proc = subprocess.run(
                cmd,
                cwd=workspace_path,
                env=env,
                stdout=log_f,
                stderr=subprocess.STDOUT,
                text=True,
                timeout=300,
            )

        expected_apk = workspace_path / "app" / "build" / "outputs" / "apk" / "release" / "app-release.apk"

        if proc.returncode == 0 and expected_apk.exists():
            final_apk_name = f"{identity['clinic_segment']}_{build_id[:8]}.apk"
            final_apk_path = APKS_DIR / final_apk_name
            shutil.copy2(expected_apk, final_apk_path)

            with _LOCK:
                _BUILD_TASKS[build_id]["status"] = "completed"
                _BUILD_TASKS[build_id]["progress"] = 100
                _BUILD_TASKS[build_id]["apk_path"] = str(final_apk_path)
                _BUILD_TASKS[build_id]["apk_filename"] = final_apk_name
                _BUILD_TASKS[build_id]["file_size"] = final_apk_path.stat().st_size
        else:
            # Check if debug apk was built
            debug_apk = workspace_path / "app" / "build" / "outputs" / "apk" / "debug" / "app-debug.apk"
            if debug_apk.exists():
                final_apk_name = f"{identity['clinic_segment']}_{build_id[:8]}.apk"
                final_apk_path = APKS_DIR / final_apk_name
                shutil.copy2(debug_apk, final_apk_path)
                with _LOCK:
                    _BUILD_TASKS[build_id]["status"] = "completed"
                    _BUILD_TASKS[build_id]["progress"] = 100
                    _BUILD_TASKS[build_id]["apk_path"] = str(final_apk_path)
                    _BUILD_TASKS[build_id]["apk_filename"] = final_apk_name
                    _BUILD_TASKS[build_id]["file_size"] = final_apk_path.stat().st_size
                return

            last_log = ""
            if log_file_path.exists():
                last_log = log_file_path.read_text(encoding="utf-8")[-1500:]

            with _LOCK:
                _BUILD_TASKS[build_id]["status"] = "failed"
                _BUILD_TASKS[build_id]["error"] = f"Gradle compilation exited with code {proc.returncode}.\n{last_log}"
                _BUILD_TASKS[build_id]["workspace_path"] = str(workspace_path)

    except subprocess.TimeoutExpired:
        with _LOCK:
            _BUILD_TASKS[build_id]["status"] = "failed"
            _BUILD_TASKS[build_id]["error"] = "Build timed out after 300 seconds."
    except Exception as e:
        with _LOCK:
            _BUILD_TASKS[build_id]["status"] = "failed"
            _BUILD_TASKS[build_id]["error"] = str(e)


def get_build_logs(build_id: str) -> str:
    """Retrieve full logs for an active or finished build."""
    log_file_path = LOGS_DIR / f"{build_id}.log"
    if log_file_path.exists():
        return log_file_path.read_text(encoding="utf-8")
    return "Build log not found or not yet started."


def trigger_app_build(
    doctor: Doctor,
    tenant: Optional[Tenant],
    custom_icon_path: Optional[str] = None,
) -> Dict[str, Any]:
    """Prepare the project and trigger the background compilation task."""
    build_id = str(uuid.uuid4())
    identity = compute_app_identity(doctor, tenant)

    APKS_DIR.mkdir(parents=True, exist_ok=True)
    WORKSPACES_DIR.mkdir(parents=True, exist_ok=True)

    with _LOCK:
        _BUILD_TASKS[build_id] = {
            "task_id": build_id,
            "status": "preparing",
            "progress": 10,
            "app_name": identity["app_name"],
            "package_name": identity["package_name"],
            "apk_path": None,
            "apk_filename": None,
            "file_size": None,
            "error": None,
        }

    workspace_path = prepare_project_workspace(build_id, doctor, tenant, custom_icon_path)

    thread = threading.Thread(
        target=run_gradle_build,
        args=(build_id, workspace_path, identity),
        daemon=True,
    )
    thread.start()

    return _BUILD_TASKS[build_id]


def get_build_status(build_id: str) -> Optional[Dict[str, Any]]:
    with _LOCK:
        if build_id in _BUILD_TASKS:
            return _BUILD_TASKS[build_id]

    # Check APKS_DIR for matching task_id prefix or direct filename
    prefix = build_id[:8].lower()
    matching = list(APKS_DIR.glob(f"*_{prefix}*.apk"))
    if not matching and build_id.endswith(".apk"):
        exact = APKS_DIR / build_id
        if exact.exists():
            matching = [exact]

    if matching:
        apk_file = matching[0]
        return {
            "task_id": build_id,
            "status": "completed",
            "progress": 100,
            "app_name": apk_file.stem.split("_")[0].replace("_", " ").title(),
            "package_name": "",
            "apk_path": str(apk_file),
            "apk_filename": apk_file.name,
            "file_size": apk_file.stat().st_size,
            "error": None,
        }
    return None


def get_latest_doctor_apk(doctor: Doctor, tenant: Optional[Tenant]) -> Optional[Dict[str, Any]]:
    """Check if an APK was already generated for this doctor and return it immediately."""
    identity = compute_app_identity(doctor, tenant)
    clinic_seg = identity["clinic_segment"]
    matching = sorted(APKS_DIR.glob(f"{clinic_seg}_*.apk"), key=lambda p: p.stat().st_mtime, reverse=True)
    if matching:
        latest = matching[0]
        parts = latest.stem.split("_")
        task_id = parts[-1] if len(parts) > 1 else "latest"
        return {
            "task_id": task_id,
            "status": "completed",
            "progress": 100,
            "app_name": identity["app_name"],
            "package_name": identity["package_name"],
            "apk_path": str(latest),
            "apk_filename": latest.name,
            "file_size": latest.stat().st_size,
        }
    return None


