"""
Patient Pydantic Schemas
"""

import uuid
from datetime import datetime, date
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.models.patient import BloodGroup, Gender


class PatientCreate(BaseModel):
    # FIX-P1 (2026-06-24): hospital_id used to be mandatory, which meant the
    # patient app could never call this endpoint at all -- it has no "pick a
    # hospital" step, and isn't supposed to need one. A Hospyn ID is a
    # health-network identity, not tied to one hospital. hospital_id stays
    # supported for the reception/walk-in flows that DO know which hospital
    # they're registering a patient at.
    hospital_id: Optional[uuid.UUID] = None
    first_name: str
    last_name: str
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[BloodGroup] = BloodGroup.UNKNOWN
    known_allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None


class PatientUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    gender: Optional[Gender] = None
    blood_group: Optional[BloodGroup] = None
    known_allergies: Optional[str] = None
    chronic_conditions: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None


class PatientResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    hospyn_id: Optional[str] = None
    hospital_id: Optional[uuid.UUID] = None
    first_name: str
    last_name: str
    email: Optional[str]
    phone: Optional[str]
    date_of_birth: Optional[date]
    gender: Optional[Gender]
    blood_group: Optional[BloodGroup]
    known_allergies: Optional[str]
    chronic_conditions: Optional[str]
    emergency_contact_name: Optional[str]
    emergency_contact_phone: Optional[str]
    address: Optional[str]
    city: Optional[str]
    state: Optional[str]
    pin_code: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PatientListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[PatientResponse]
