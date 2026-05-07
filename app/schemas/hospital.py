from pydantic import BaseModel, Field, validator
from typing import Optional, List
from datetime import datetime

class DepartmentBase(BaseModel):
    name: str = Field(..., max_length=100, description="Name of the department/zone (e.g., 'ICU Wing A')")

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: int
    hospital_id: int

    class Config:
        from_attributes = True

class HospitalBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=255, description="Official Hospital Name")
    registration_number: str = Field(..., min_length=3, max_length=100, description="Government or Board Registration ID")
    subscription_status: str = Field(default="active")

class HospitalCreate(HospitalBase):
    """
    Schema for registering a new tenant hospital.
    """
    pass

class HospitalResponse(HospitalBase):
    """
    Schema for returning hospital details.
    """
    id: int
    version_id: int = Field(..., description="Optimistic locking version")
    created_at: datetime = Field(..., description="UTC creation timestamp")
    departments: List[DepartmentResponse] = []

    class Config:
        from_attributes = True

class BedBase(BaseModel):
    department_id: int
    status: str = Field(..., description="Current status: AVAILABLE, TEMP_RESERVED, RESERVED, OCCUPIED, DISCHARGE_INITIATED, PENDING_CLEANING")

class BedResponse(BedBase):
    id: int
    version_id: int

    class Config:
        from_attributes = True
