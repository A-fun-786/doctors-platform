from typing import List, Optional, Literal
from pydantic import BaseModel, Field

CalendarEventType = Literal["AVAILABLE", "LEAVE", "HOLIDAY", "BLOCKED", "APPOINTMENT"]


class CalendarEvent(BaseModel):
    """Calendar event representing an available slot, exclusion, or appointment."""

    type: str = Field(..., description="Type of event (AVAILABLE, LEAVE, HOLIDAY, BLOCKED, APPOINTMENT)")
    start: str = Field(..., description="Start time (HH:MM)")
    end: str = Field(..., description="End time (HH:MM)")
    reason: Optional[str] = Field(None, description="Reason for blocked/leave/holiday entry")
    patient_name: Optional[str] = Field(None, description="Patient name if appointment")
    status: Optional[str] = Field(None, description="Appointment status (BOOKED, COMPLETED)")
    appointment_id: Optional[str] = Field(None, description="Appointment UUID string if appointment")


class CalendarDay(BaseModel):
    """Calendar events for a single date."""

    date: str = Field(..., description="Date (YYYY-MM-DD)")
    events: List[CalendarEvent] = Field(default_factory=list, description="Chronologically sorted events")


class DoctorCalendarResponse(BaseModel):
    """Unified doctor operational calendar response."""

    dates: List[CalendarDay] = Field(default_factory=list, description="List of days containing events")
