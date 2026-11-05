import uuid
from datetime import date, datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field

# Core Type Literals
StaffRole = Literal[
    "Doctor",
    "Junior Doctor",
    "Nurse",
    "Receptionist",
    "Pharmacist",
    "Lab Technician",
    "Billing Executive",
    "Administrative Assistant",
    "Other",
]
StaffStatus = Literal["active", "on_leave", "inactive", "terminated"]
EmploymentType = Literal["full_time", "part_time", "contract", "shift"]


# ---------------------------------------------------------------------------
# Staff Member Schemas
# ---------------------------------------------------------------------------
class StaffMemberCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: Optional[str] = Field(None, max_length=255)
    phone: str = Field(..., min_length=5, max_length=30)
    role: str = Field(..., min_length=1, max_length=50)
    department: str = Field("Clinical", max_length=50)
    employment_type: EmploymentType = "full_time"
    status: StaffStatus = "active"
    joining_date: Optional[date] = None
    base_salary_paise: int = Field(0, ge=0)
    emergency_contact: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

    # Authentication & Access Control
    can_login: bool = False
    password: Optional[str] = Field(None, min_length=6, max_length=100)


class StaffMemberUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, min_length=5, max_length=30)
    role: Optional[str] = Field(None, min_length=1, max_length=50)
    department: Optional[str] = Field(None, max_length=50)
    employment_type: Optional[EmploymentType] = None
    status: Optional[StaffStatus] = None
    joining_date: Optional[date] = None
    base_salary_paise: Optional[int] = Field(None, ge=0)
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None

    # Authentication & Access Control
    can_login: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    must_change_password: Optional[bool] = None


class StaffMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doctor_id: uuid.UUID
    full_name: str
    email: Optional[str] = None
    phone: str
    role: str
    department: str
    employment_type: str
    status: str
    joining_date: date
    base_salary_paise: int
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None
    can_login: bool = False
    must_change_password: bool = True
    last_login_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class StaffPasswordResetRequest(BaseModel):
    new_password: str = Field(..., min_length=6, max_length=100)


class StaffSelfPasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6, max_length=100)


class StaffSummaryMetricsResponse(BaseModel):
    total_staff: int
    active_staff: int
    doctors_count: int
    departments_count: int
