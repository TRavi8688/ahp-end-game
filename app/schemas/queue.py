from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional

class QueueTokenStatus(str, Enum):
    pending = "pending"
    processed = "processed"
    cancelled = "cancelled"
    completed = "completed"
    no_show = "no_show"
    registered = "registered"

class QueueTokenCreate(BaseModel):
    patient_id: int = Field(..., description="Reference to patient profile ID")
    is_emergency: Optional[bool] = Field(False, description="True if this is an emergency case")
    is_vip: Optional[bool] = Field(False, description="True if patient has VIP status")
    age: Optional[int] = Field(None, description="Patient age, used for elderly priority (>=65)")
    is_follow_up: Optional[bool] = Field(False, description="True if this is a follow‑up visit")

class QueueTokenRead(BaseModel):
    id: int
    patient_id: int
    status: QueueTokenStatus
    priority_score: int
    created_at: str
    updated_at: str
    version_id: int

    class Config:
        orm_mode = True
