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


class WorkingHoursShift(BaseModel):
    """Doctor recurring shift configuration."""
    id: str = Field(..., description="Unique shift identifier (e.g., 'morning', 'evening')")
    label: str = Field(..., description="Display label for shift")
    start: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$", description="Start time in HH:MM format")
    end: str = Field(..., pattern=r"^([01]\d|2[0-3]):[0-5]\d$", description="End time in HH:MM format")
    enabled: bool = Field(True, description="Whether shift is active")

    @model_validator(mode="after")
    def validate_shift(self) -> "WorkingHoursShift":
        start_h, start_m = map(int, self.start.split(":"))
        end_h, end_m = map(int, self.end.split(":"))

        if start_m % 30 != 0 or end_m % 30 != 0:
            raise ValueError("start and end time minutes must be in 30-minute intervals (e.g., :00 or :30)")

        start_total = start_h * 60 + start_m
        end_total = end_h * 60 + end_m

        if end_total <= start_total:
            raise ValueError(f"end time ({self.end}) must be strictly after start time ({self.start})")

        return self


class DoctorWorkingHoursUpdate(BaseModel):
    """Payload to configure doctor weekly shifts and closed days."""
    shifts: List[WorkingHoursShift] = Field(..., max_length=4, description="List of shifts (max 4)")
    closed_days: List[int] = Field(default_factory=list, description="Array of closed day indexes (0=Sun, 1=Mon, ..., 6=Sat)")

    @model_validator(mode="after")
    def validate_working_hours(self) -> "DoctorWorkingHoursUpdate":
        for day in self.closed_days:
            if not isinstance(day, int) or day < 0 or day > 6:
                raise ValueError("closed_days entries must be integers between 0 (Sunday) and 6 (Saturday)")

        if len(self.closed_days) != len(set(self.closed_days)):
            raise ValueError("closed_days cannot contain duplicate entries")

        # Check for overlapping enabled shifts
        enabled_shifts = [s for s in self.shifts if s.enabled]
        sorted_shifts = sorted(
            enabled_shifts,
            key=lambda s: int(s.start.split(":")[0]) * 60 + int(s.start.split(":")[1]),
        )
        for i in range(len(sorted_shifts) - 1):
            curr_end_m = int(sorted_shifts[i].end.split(":")[0]) * 60 + int(sorted_shifts[i].end.split(":")[1])
            next_start_m = int(sorted_shifts[i + 1].start.split(":")[0]) * 60 + int(sorted_shifts[i + 1].start.split(":")[1])
            if curr_end_m > next_start_m:
                raise ValueError(
                    f"Overlapping shifts detected: '{sorted_shifts[i].label}' ({sorted_shifts[i].start}-{sorted_shifts[i].end}) "
                    f"overlaps with '{sorted_shifts[i + 1].label}' ({sorted_shifts[i + 1].start}-{sorted_shifts[i + 1].end})"
                )

        return self


class DoctorWorkingHoursResponse(BaseModel):
    """Strongly-typed response payload for doctor working hours."""
    shifts: List[WorkingHoursShift]
    closed_days: List[int] = Field(default_factory=list)


DEFAULT_DOCTOR_WORKING_HOURS: dict = {
    "shifts": [
        {"id": "morning", "label": "Morning Shift", "start": "10:00", "end": "13:00", "enabled": True},
        {"id": "evening", "label": "Evening Shift", "start": "16:00", "end": "20:00", "enabled": True},
    ],
    "closed_days": [0],
}


