import uuid
from datetime import date, time, datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

ScheduleType = Literal["AVAILABLE", "LEAVE", "HOLIDAY", "BLOCKED"]


class ScheduleCreateRequest(BaseModel):
    """Payload to create a schedule entry (working hours or unavailable period)."""
    date: date
    start_time: time
    end_time: time
    type: ScheduleType
    reason: Optional[str] = None

    @model_validator(mode="after")
    def validate_time_range(self) -> "ScheduleCreateRequest":
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self


class ScheduleBulkCreateRequest(BaseModel):
    """Payload to create multiple schedule entries at once."""
    entries: List[ScheduleCreateRequest] = Field(..., min_length=1)


class ScheduleResponse(BaseModel):
    """Full schedule entry response."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doctor_id: uuid.UUID
    date: date
    start_time: time
    end_time: time
    type: str
    reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AvailableSlotResponse(BaseModel):
    """30-minute bookable slot representation."""
    start: str
    end: str


class ScheduleListResponse(BaseModel):
    """Paginated list of schedule entries."""
    items: List[ScheduleResponse]
    page: int
    page_size: int
    total: int

