from pydantic import BaseModel, EmailStr, Field, field_validator
import re
from typing import List, Optional
from datetime import datetime

# Auth Schemas
class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class TokenPayload(BaseModel):
    sub: Optional[str] = None # email
    role: Optional[str] = None

class OTPRequest(BaseModel):
    identifier: str = Field(..., description="Phone number or Email")
    country_code: str = "+91"
    method: str = "sms"

class OTPVerify(BaseModel):
    identifier: str
    otp: str

# User Schemas
class UserBase(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

    @field_validator('password')
    @classmethod
    def validate_password(cls, v: str) -> str:
        if not re.search(r"[0-9]", v):
            raise ValueError('Password must contain at least one number')
        if not re.search(r"[!@#$%^&*.,]", v):
            raise ValueError('Password must contain at least one special character')
        return v

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(UserBase):
    id: int
    created_at: datetime
    class Config:
        from_attributes = True

# Patient Schemas
class PatientBase(BaseModel):
    hospyn_id: str
    phone_number: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    language_code: str = "en"

class PatientCreate(BaseModel):
    first_name: str
    last_name: str
    phone_number: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    language_code: str = "en"
    conditions: List[str] = []
    medications: List[str] = []

class PatientResponse(PatientBase):
    id: int
    class Config:
        from_attributes = True

class LoginHospynRequest(BaseModel):
    hospyn_id: str
    password: str

# Medical Record Schemas
class MedicalRecordBase(BaseModel):
    type: str
    file_url: str

class MedicalRecordResponse(MedicalRecordBase):
    id: int
    ai_summary: Optional[str] = None
    patient_summary: Optional[str] = None
    doctor_summary: Optional[str] = None
    created_at: datetime
    class Config:
        from_attributes = True

# Doctor Schemas
class DoctorBase(BaseModel):
    specialty: str
    license_number: str

class DoctorResponse(DoctorBase):
    id: int
    license_status: str
    class Config:
        from_attributes = True

# Analytics / Dashboard
class DashboardMetrics(BaseModel):
    health_score: Optional[int] = None
    alerts: List[dict] = []
    conditions: List[str] = []
    medications: List[dict] = []

# Doctor Verification Schemas
class DoctorVerifyStart(BaseModel):
    full_name: str = Field(..., description="Full Name")
    registration_number: str = Field(..., description="Medical Registration Number")
    state_medical_council: str = Field(..., description="State Medical Council")
    mobile_number: str = Field(..., description="Mobile Number")

class DoctorVerifySessionResponse(BaseModel):
    session_id: str
    status: str

class DoctorVerifyOTP(BaseModel):
    session_id: str
    otp: str

class DoctorVerifyComplete(BaseModel):
    session_id: str
    password: str

# New Doctor-Patient Interaction Schemas
class DoctorScanRequest(BaseModel):
    hospyn_id: str
    clinic_name: str
    access_level: str

class DoctorScanResponse(BaseModel):
    status: str
    message: str
    access_id: Optional[int] = None

class PatientPublicProfile(BaseModel):
    hospyn_id: str
    name: str

class PatientLookupResponse(BaseModel):
    profile: PatientPublicProfile
    allergies: List[dict] = []
    status: str = "active"

# Queue Management Schemas
class QueueEntryBase(BaseModel):
    hospyn_id: str
    clinic_name: Optional[str] = None

class QueueEntryResponse(BaseModel):
    id: int
    patient_name: str
    hospyn_id: str
    status: str
    token_number: Optional[int]
    check_in_time: datetime

    class Config:
        from_attributes = True

class QueueUpdate(BaseModel):
    status: str # active, completed, cancelled

# AI & Chat Schemas
class ChatRequest(BaseModel):
    text: Optional[str] = None
    language_code: str = "en-IN"

class ChatResponse(BaseModel):
    ai_text: str
    conversation_id: str

class ChatMessageResponse(BaseModel):
    sender: str # 'user' or 'ai'
    message_text: str
    created_at: datetime

class ReportAnalysisResponse(BaseModel):
    status: str = "success"
    summary: Optional[str] = None
    extracted_data: Optional[dict] = None
    visual_findings: Optional[str] = None
    url: str
    type: str = "Document"

class ReportConfirmSave(BaseModel):
    analysis: dict
    s3_url: str
    type: str
    update_profile: bool = False

class PatientProfileResponse(BaseModel):
    id: int
    full_name: Optional[str] = "Patient"
    email: Optional[EmailStr] = None
    phone_number: Optional[str] = None
    hospyn_id: str
    age: Optional[int] = None
    blood_group: Optional[str] = None
    gender: Optional[str] = None
    recent_records: List[MedicalRecordResponse] = []

class JobStatusResponse(BaseModel):
    job_id: str
    status: str # queued, in_progress, completed, failed
    progress: int = 0
    result: Optional[dict] = None

class SetPasswordRequest(BaseModel):
    password: str

class ShareRecordRequest(BaseModel):
    record_id: int
    doctor_query: str = Field(..., description="Doctor name or Mulajna ID")
    expires_hours: int = 24
