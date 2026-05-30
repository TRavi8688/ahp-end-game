"""
Hospital Pydantic Schemas

Request/Response schemas for the Hospital API.
Enforces strict validation at the API boundary.
"""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
from app.models.hospital import HospitalStatus


class HospitalCreate(BaseModel):
    name: str
    registration_number: str
    license_number: Optional[str] = None
    email: EmailStr
    phone: str
    website: Optional[str] = None
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    country: str = "India"
    pin_code: str
    description: Optional[str] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        cleaned = v.replace(" ", "").replace("-", "")
        if not cleaned.lstrip("+").isdigit():
            raise ValueError("Invalid phone number format")
        return cleaned

    @field_validator("pin_code")
    @classmethod
    def validate_pin_code(cls, v: str) -> str:
        if not v.isdigit():
            raise ValueError("PIN code must be numeric")
        return v


class HospitalUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None
    description: Optional[str] = None


class HospitalResponse(BaseModel):
    id: uuid.UUID
    name: str
    registration_number: str
    email: str
    phone: str
    website: Optional[str]
    address_line1: str
    address_line2: Optional[str]
    city: str
    state: str
    country: str
    pin_code: str
    status: HospitalStatus
    is_active: bool
    description: Optional[str]
    owner_user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class HospitalListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[HospitalResponse]
