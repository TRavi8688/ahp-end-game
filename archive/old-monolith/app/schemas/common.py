from pydantic import BaseModel, Field
from typing import Optional, Generic, TypeVar, Any
from datetime import datetime

T = TypeVar("T")

class StandardErrorSchema(BaseModel):
    """
    Enterprise Structured Error Contract
    Provides consistency across all APIs for the frontend to consume.
    """
    error_code: str = Field(..., description="A constant string code (e.g., 'VALIDATION_FAILED', 'BED_OCCUPIED')")
    message: str = Field(..., description="Human-readable error description")
    trace_id: str = Field(..., description="X-Request-ID for correlation across logs")
    details: Optional[Any] = Field(None, description="Additional context or validation errors")

class APIResponse(BaseModel, Generic[T]):
    """
    Standard Wrapper for all successful API responses.
    """
    success: bool = True
    data: Optional[T] = None
    trace_id: str = Field(..., description="X-Request-ID for correlation")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="UTC Timestamp of response")
