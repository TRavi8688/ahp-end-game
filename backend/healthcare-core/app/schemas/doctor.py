"""
Doctor Pydantic Schemas
"""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
from app.models.doctor import DoctorStatus


class DoctorCreate(BaseModel):
    hospital_id: uuid.UUID
    first_name: str
    last_name: str
    email: EmailStr
    phone: Optional[str] = None
    specialization: str
    qualification: Optional[str] = None
    medical_license_number: str
    years_of_experience: int = 0
    consultation_fee: int = 0  # in paisa
    bio: Optional[str] = None

    @field_validator("years_of_experience")
    @classmethod
    def validate_experience(cls, v: int) -> int:
        if v < 0 or v > 80:
            raise ValueError("Years of experience must be between 0 and 80")
        return v

    @field_validator("consultation_fee")
    @classmethod
    def validate_fee(cls, v: int) -> int:
        if v < 0:
            raise ValueError("Consultation fee cannot be negative")
        return v


class DoctorUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    specialization: Optional[str] = None
    qualification: Optional[str] = None
    years_of_experience: Optional[int] = None
    consultation_fee: Optional[int] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    status: Optional[DoctorStatus] = None


class DoctorResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    hospital_id: uuid.UUID
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]
    specialization: str
    qualification: Optional[str]
    medical_license_number: str
    years_of_experience: int
    consultation_fee: int
    bio: Optional[str]
    avatar_url: Optional[str]
    status: DoctorStatus
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DoctorListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[DoctorResponse]
