import uuid
from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional

class QueueTokenStatus(str, Enum):
    WAITING = "WAITING"
    IN_PROGRESS = "IN_PROGRESS"
    PAUSED = "PAUSED"
    COMPLETED = "COMPLETED"
    EMERGENCY_OVERRIDE = "EMERGENCY_OVERRIDE"

class QueueTokenCreate(BaseModel):
    patient_id: uuid.UUID = Field(..., description="Reference to patient profile ID")
    is_emergency: Optional[bool] = Field(False, description="True if this is an emergency case")
    is_vip: Optional[bool] = Field(False, description="True if patient has VIP status")
    age: Optional[int] = Field(None, description="Patient age, used for elderly priority (>=65)")
    is_follow_up: Optional[bool] = Field(False, description="True if this is a follow‑up visit")

class QueueTokenRead(BaseModel):
    id: uuid.UUID
    patient_id: uuid.UUID
    status: QueueTokenStatus
    priority_score: int
    created_at: datetime
    updated_at: datetime
    version_id: int

    class Config:
        from_attributes = True
