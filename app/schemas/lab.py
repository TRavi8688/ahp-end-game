from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from uuid import UUID
from datetime import datetime
from app.models.models import LabOrderStatusEnum, LabTestCategory

class LabTestBase(BaseModel):
    test_name: str
    category: LabTestCategory
    code: Optional[str] = None
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    base_price: float = 0.0

class LabTestCreate(LabTestBase):
    pass

class LabTestResponse(LabTestBase):
    id: UUID
    hospital_id: UUID

    class Config:
        from_attributes = True

class LabOrderCreate(BaseModel):
    patient_id: UUID
    visit_id: Optional[UUID] = None
    prescription_id: Optional[UUID] = None
    tests: List[Dict] # List of {test_id, test_name}
    clinical_history: Optional[str] = None

class LabResultSubmit(BaseModel):
    test_name: str
    value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    is_abnormal: bool = False
    clinical_remarks: Optional[str] = None

class LabOrderResultSubmit(BaseModel):
    results: List[LabResultSubmit]
    ai_risk_analysis: bool = True

class LabOrderResponse(BaseModel):
    id: UUID
    patient_id: UUID
    patient_name: Optional[str] = None
    status: LabOrderStatusEnum
    tests: List[Dict]
    sample_id: Optional[str] = None
    created_at: datetime
    collected_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
class LabStatusUpdate(BaseModel):
    status: LabOrderStatusEnum
    remarks: Optional[str] = None
    sample_id: Optional[str] = None
