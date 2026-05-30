from pydantic import BaseModel, EmailStr
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid

class AuditLog(BaseModel):
    id: uuid.UUID
    user_id: Optional[uuid.UUID]
    action: str
    resource_type: str
    resource_id: Optional[uuid.UUID]
    details: Dict[str, Any]
    signature: str
    prev_hash: str
    timestamp: datetime

    class Config:
        from_attributes = True

class AdminStats(BaseModel):
    total_hospitals: int
    total_patients: int
    total_doctors: int
    active_sessions: int

class OrganizationAnalytics(BaseModel):
    hospyn_id: str
    patient_count: int
    revenue: float
    trust_score: str
