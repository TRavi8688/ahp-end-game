from pydantic import BaseModel, Field, EmailStr, HttpUrl
from typing import List, Optional
from datetime import datetime
from uuid import UUID

from app.models.hospital_verification import (
    VerificationTaskStatusEnum,
    VerificationTaskPriorityEnum,
    HospitalDocumentTypeEnum,
    VerificationActionTypeEnum,
    FraudSignalTypeEnum,
    FraudSeverityEnum,
    BlacklistTypeEnum
)
from app.models.core import HospitalVerificationStatusEnum

# --- Base Schemas ---

class VerificationTaskBase(BaseModel):
    hospital_id: UUID
    assigned_verifier_id: Optional[UUID] = None
    status: VerificationTaskStatusEnum = VerificationTaskStatusEnum.open
    priority: VerificationTaskPriorityEnum = VerificationTaskPriorityEnum.medium
    escalation_level: int = 0

class HospitalDocumentBase(BaseModel):
    hospital_id: UUID
    document_type: HospitalDocumentTypeEnum
    document_url: str
    document_status: str = "pending"
    expiry_date: Optional[datetime] = None
    ai_confidence_score: float = 0.0
    extracted_text: Optional[str] = None
    is_blurry: bool = False

class VerificationHistoryBase(BaseModel):
    hospital_id: UUID
    verifier_id: Optional[UUID] = None
    action_type: VerificationActionTypeEnum
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    notes: Optional[str] = None
    ip_address: Optional[str] = None

class HospitalEditDraftBase(BaseModel):
    hospital_id: UUID
    field_name: str
    old_value: Optional[str] = None
    proposed_value: str

class VerifierNoteBase(BaseModel):
    hospital_id: UUID
    note: str

class FraudSignalBase(BaseModel):
    hospital_id: UUID
    signal_type: FraudSignalTypeEnum
    severity: FraudSeverityEnum
    description: Optional[str] = None

# --- Create Schemas ---

class VerifierNoteCreate(VerifierNoteBase):
    pass

class HospitalEditDraftCreate(HospitalEditDraftBase):
    pass

# --- Read Schemas ---

class VerificationTaskRead(VerificationTaskBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True

class HospitalDocumentRead(HospitalDocumentBase):
    id: UUID
    verified_by: Optional[UUID] = None
    verified_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class VerificationHistoryRead(VerificationHistoryBase):
    id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class VerifierNoteRead(VerifierNoteBase):
    id: UUID
    verifier_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True

class FraudSignalRead(FraudSignalBase):
    id: UUID
    detected_at: datetime

    class Config:
        from_attributes = True

# --- API Payloads ---

class VerificationActionPayload(BaseModel):
    notes: Optional[str] = None

class RequestMoreInfoPayload(BaseModel):
    missing_items: List[str]
    custom_message: Optional[str] = None

class HospitalVerificationDetailResponse(BaseModel):
    id: UUID
    name: str
    hospital_email: Optional[EmailStr]
    hospital_phone: Optional[str]
    domain: Optional[str]
    gst_number: Optional[str]
    status: HospitalVerificationStatusEnum
    risk_score: int
    trust_score: int
    submitted_at: Optional[datetime]
    
    task: Optional[VerificationTaskRead]
    documents: List[HospitalDocumentRead] = []
    history: List[VerificationHistoryRead] = []
    notes: List[VerifierNoteRead] = []
    fraud_signals: List[FraudSignalRead] = []

    class Config:
        from_attributes = True
