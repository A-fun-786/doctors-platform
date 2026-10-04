import uuid
from datetime import date, time, datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

AppointmentStatus = Literal["BOOKED", "COMPLETED", "CANCELLED"]


class AppointmentCreateRequest(BaseModel):
    """Payload to create an appointment."""
    patient_name: str = Field(..., min_length=1)
    patient_contact: Optional[str] = None
    date: date
    start_time: time
    end_time: time
    reason: Optional[str] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_time_range(self) -> "AppointmentCreateRequest":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AppointmentRescheduleRequest(BaseModel):
    """Payload to reschedule an existing appointment."""
    date: date
    start_time: time
    end_time: time

    @model_validator(mode="after")
    def validate_time_range(self) -> "AppointmentRescheduleRequest":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class AppointmentResponse(BaseModel):
    """Full appointment entity response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doctor_id: uuid.UUID
    patient_id: Optional[uuid.UUID] = None
    request_id: Optional[uuid.UUID] = None
    patient_name: str
    patient_contact: Optional[str] = None
    date: date
    start_time: time
    end_time: time
    reason: Optional[str] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime
    updated_at: datetime


class AppointmentListResponse(BaseModel):
    """Paginated list of appointments."""
    items: List[AppointmentResponse]
    page: int
    page_size: int
    total: int
