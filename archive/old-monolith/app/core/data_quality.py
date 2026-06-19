from fastapi import Request, HTTPException, status
from pydantic import BaseModel, ValidationError, validator
import re
import logging

logger = logging.getLogger(__name__)

class PatientIngestionPayload(BaseModel):
    """
    Data Quality Layer.
    Strictly validates incoming patient telemetry or records before hitting the DB.
    Ensures that bad data from a branch hospital doesn't corrupt the ecosystem.
    """
    national_id: str
    first_name: str
    last_name: str
    phone_number: str
    
    @validator("national_id")
    def validate_national_id(cls, v):
        # Prevent completely malformed IDs (basic anomaly detection)
        if not re.match(r"^[A-Z0-9-]{6,15}$", v):
            raise ValueError("National ID fails quality schema validation.")
        return v
        
    @validator("phone_number")
    def validate_phone(cls, v):
        # E.164 format enforcement
        if not re.match(r"^\+?[1-9]\d{1,14}$", v):
            raise ValueError("Phone number must be E.164 compliant.")
        return v

async def data_quality_guard(request: Request):
    """
    FastAPI Middleware/Dependency to intercept malformed payloads.
    Logs data quality anomalies for infrastructure observability.
    """
    try:
        body = await request.json()
        PatientIngestionPayload(**body)
        return body
    except ValidationError as e:
        logger.warning(f"DATA_QUALITY_ANOMALY: Payload rejected. Errors: {e.errors()}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "Data Quality Violation", "issues": e.errors()}
        )
    except Exception:
        # If it's not even valid JSON
        logger.warning("DATA_QUALITY_ANOMALY: Malformed JSON received.")
        raise HTTPException(status_code=400, detail="Invalid JSON format.")
