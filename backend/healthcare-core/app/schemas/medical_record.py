"""
Medical Record Pydantic Schemas
"""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class MedicalRecordResponse(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    record_name: str
    hospital_name: Optional[str] = None
    file_url: Optional[str] = None
    record_type: Optional[str] = None
    ai_summary: Optional[str] = None
    ai_extracted: Optional[str] = None
    raw_text: Optional[str] = None
    patient_summary: Optional[str] = None
    hidden_by_patient: bool = False
    created_at: datetime
    updated_at: datetime

    # Populated at runtime, not from the DB column
    secure_url: Optional[str] = None

    model_config = {"from_attributes": True}


class MedicalRecordListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[MedicalRecordResponse]
