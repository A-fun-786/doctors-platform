import re
import uuid
from datetime import date, datetime
from typing import Optional, List, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from app.models.staff import is_doctor_role

# Core Type Literals
StaffRole = Literal[
    "Doctor",
    "Nurse",
    "Receptionist",
    "Other",
]
StaffStatus = Literal["active", "on_leave", "inactive", "terminated"]
EmploymentType = Literal["full_time", "part_time", "contract", "shift"]

EMAIL_REGEX = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$"
)
PHONE_ALLOWED_CHARS_REGEX = re.compile(r"^\+?[0-9\s\-().]{7,25}$")
USERNAME_ALLOWED_CHARS_REGEX = re.compile(r"^[a-zA-Z0-9._-]+$")


def validate_staff_username(val: Optional[str]) -> Optional[str]:
    """Validate and normalize staff User ID ensuring lowercase alphanumeric format (rejecting '@')."""
    if val is None:
        return None
    cleaned = str(val).strip().lower()
    if not cleaned:
        return None
    if not (3 <= len(cleaned) <= 60 and USERNAME_ALLOWED_CHARS_REGEX.match(cleaned)):
        raise ValueError("User ID must be between 3 and 60 alphanumeric characters (dots, underscores, and hyphens allowed). Do not include '@'.")
    return cleaned


def validate_staff_phone(val: Optional[str]) -> Optional[str]:
    """Validate phone number ensuring allowed format and realistic digit count (7-15 digits)."""
    if val is None:
        return None
    cleaned = str(val).strip()
    if not cleaned:
        raise ValueError("Phone number cannot be empty.")
    if not PHONE_ALLOWED_CHARS_REGEX.match(cleaned):
        raise ValueError("Phone number contains invalid characters. Use digits, +, -, and spaces.")
    digits = [c for c in cleaned if c.isdigit()]
    if len(digits) < 7 or len(digits) > 15:
        raise ValueError("Phone number must contain between 7 and 15 digits.")
    return cleaned


def validate_staff_email(val: Optional[str]) -> Optional[str]:
    """Validate email ensuring proper RFC format when provided."""
    if val is None:
        return None
    cleaned = str(val).strip().lower()
    if not cleaned:
        return None
    if not EMAIL_REGEX.match(cleaned):
        raise ValueError("Invalid email address format (e.g. name@example.com).")
    return cleaned


# ---------------------------------------------------------------------------
# Staff Member Schemas
# ---------------------------------------------------------------------------
class StaffMemberCreate(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=120)
    email: Optional[str] = Field(None, max_length=255)
    phone: str = Field(..., min_length=5, max_length=30)
    role: str = Field(..., min_length=1, max_length=50)
    speciality: Optional[str] = Field(None, max_length=100, description="Mandatory medical speciality for doctors (e.g. Cardiologist, General Physician)")
    department: str = Field("Clinical", max_length=50)
    employment_type: EmploymentType = "full_time"
    status: StaffStatus = "active"
    joining_date: Optional[date] = None
    base_salary_paise: int = Field(0, ge=0)
    emergency_contact: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

    # Authentication & Access Control
    username: Optional[str] = Field(None, min_length=3, max_length=60, description="Optional custom User ID (alphanumeric with dots). If omitted, automatically generated from staff name.")
    can_login: bool = False
    password: Optional[str] = Field(None, min_length=6, max_length=100)

    @field_validator("username", mode="before")
    @classmethod
    def check_username(cls, v):
        return validate_staff_username(v)

    @field_validator("phone", mode="before")
    @classmethod
    def check_phone(cls, v):
        return validate_staff_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def check_email(cls, v):
        return validate_staff_email(v)

    @model_validator(mode="after")
    def validate_doctor_speciality(self):
        if self.role is not None:
            if is_doctor_role(self.role):
                if not self.speciality or not self.speciality.strip():
                    self.speciality = "General Physician"
                else:
                    self.speciality = self.speciality.strip()
            else:
                if not self.speciality:
                    self.speciality = None
                else:
                    self.speciality = self.speciality.strip()
        elif self.speciality:
            self.speciality = self.speciality.strip()
        return self


class StaffMemberUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, min_length=5, max_length=30)
    role: Optional[str] = Field(None, min_length=1, max_length=50)
    speciality: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=50)
    employment_type: Optional[EmploymentType] = None
    status: Optional[StaffStatus] = None
    joining_date: Optional[date] = None
    base_salary_paise: Optional[int] = Field(None, ge=0)
    emergency_contact: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

    # Authentication & Access Control
    username: Optional[str] = Field(None, min_length=3, max_length=60)
    can_login: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=6, max_length=100)
    must_change_password: Optional[bool] = None

    @field_validator("username", mode="before")
    @classmethod
    def check_username(cls, v):
        return validate_staff_username(v)

    @field_validator("phone", mode="before")
    @classmethod
    def check_phone(cls, v):
        if v is None:
            return None
        return validate_staff_phone(v)

    @field_validator("email", mode="before")
    @classmethod
    def check_email(cls, v):
        return validate_staff_email(v)

    @model_validator(mode="after")
    def validate_doctor_speciality(self):
        if self.role is not None:
            if is_doctor_role(self.role):
                if not self.speciality or not self.speciality.strip():
                    self.speciality = "General Physician"
                else:
                    self.speciality = self.speciality.strip()
            else:
                if not self.speciality:
                    self.speciality = None
                else:
                    self.speciality = self.speciality.strip()
        elif self.speciality:
            self.speciality = self.speciality.strip()
        return self


class StaffMemberResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    doctor_id: uuid.UUID
    full_name: str
    username: Optional[str] = None
    email: Optional[str] = None
    phone: str
    role: str
    speciality: Optional[str] = None
    department: str
    employment_type: str
    status: str
    joining_date: date
    base_salary_paise: Optional[int] = None
    emergency_contact: Optional[str] = None
    notes: Optional[str] = None
    can_login: bool = False
    must_change_password: bool = True
    last_login_at: Optional[datetime] = None
    token_version: int = 1
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
