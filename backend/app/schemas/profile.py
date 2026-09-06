import uuid
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, ConfigDict, Field


class ServicesConfig(BaseModel):
    """Platform services configured for the practice."""
    appointment: bool = True
    video_consultation: bool = True
    medicine_inventory: bool = False
    lab_reports: bool = False


class DoctorProfileResponse(BaseModel):
    """Full authenticated doctor profile and practice settings."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    full_name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    speciality: Optional[str] = None
    bio: Optional[str] = None
    onboarding_completed: bool = False
    
    # Practice / Tenant workspace info
    tenant_id: Optional[uuid.UUID] = None
    tenant_slug: Optional[str] = None
    clinic_name: Optional[str] = None
    location: Optional[str] = None
    services: ServicesConfig


class DoctorProfileUpdateRequest(BaseModel):
    """Payload to update doctor profile, clinic, and enabled services."""
    full_name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    speciality: Optional[str] = None
    bio: Optional[str] = None
    clinic_name: Optional[str] = None
    location: Optional[str] = None
    services: Optional[ServicesConfig] = None
    onboarding_completed: Optional[bool] = None


class PublicDoctorProfileResponse(BaseModel):
    """Sanitized public practice information for the patient-facing webpage."""
    full_name: str
    avatar_url: Optional[str] = None
    speciality: Optional[str] = None
    bio: Optional[str] = None
    clinic_name: Optional[str] = None
    location: Optional[str] = None
    slug: str
    services: ServicesConfig


class AppointmentBookingRequest(BaseModel):
    """Patient appointment booking payload."""
    patient_name: str = Field(..., min_length=2)
    patient_email: str
    patient_phone: str = Field(..., min_length=7)
    appointment_date: str
    appointment_time: str
    appointment_type: str = "in_clinic"  # "in_clinic" | "video_consultation"
    notes: Optional[str] = None


class AppointmentBookingResponse(BaseModel):
    booking_id: str
    status: str
    message: str
    details: Dict[str, Any]


class ReportUploadRequest(BaseModel):
    """Patient lab report upload payload."""
    patient_name: str = Field(..., min_length=2)
    patient_phone: str = Field(..., min_length=7)
    report_type: str
    file_name: str
    notes: Optional[str] = None


class ReportUploadResponse(BaseModel):
    report_id: str
    status: str
    message: str


class MedicineOrderRequest(BaseModel):
    """Patient medicine order / refill request payload."""
    patient_name: str = Field(..., min_length=2)
    patient_phone: str = Field(..., min_length=7)
    delivery_address: str = Field(..., min_length=5)
    medicines: str = Field(..., min_length=2)
    prescription_note: Optional[str] = None


class MedicineOrderResponse(BaseModel):
    order_id: str
    status: str
    message: str
