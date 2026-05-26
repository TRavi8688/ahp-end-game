from uuid import uuid4
from datetime import datetime
from pydantic import BaseModel, ConfigDict
from typing import Optional, List
import pydantic

class MedicationOrder(BaseModel):
    name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = None

class PrescriptionBase(BaseModel):
    patient_id: str
    visit_id: Optional[str] = None
    diagnosis: Optional[str] = None
    medications: List[MedicationOrder]
    notes: Optional[str] = None

class PrescriptionResponse(PrescriptionBase):
    id: uuid4
    doctor_id: uuid4
    hospital_id: uuid4
    status: str
    created_at: datetime
    signature_hash: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class MockModel:
    def __init__(self):
        self.patient_id = uuid4()
        self.visit_id = None
        self.diagnosis = "Test"
        self.medications = []
        self.notes = ""
        self.id = uuid4()
        self.doctor_id = uuid4()
        self.hospital_id = uuid4()
        self.status = "pending"
        self.created_at = datetime.now()
        self.signature_hash = None

try:
    obj = MockModel()
    resp = PrescriptionResponse.model_validate(obj)
    print("SUCCESS:", resp.model_dump_json())
except pydantic.ValidationError as e:
    print("VALIDATION ERROR:", e)
