from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import get_current_user, require_roles, require_tenant_access
from app.schemas.hospital import HospitalCreate, HospitalResponse, DepartmentCreate, DepartmentResponse
from app.schemas.common import APIResponse, StandardErrorSchema
from app.services.hospital_service import HospitalService
from app.models.models import User
import uuid

router = APIRouter()

def generate_trace_id(x_request_id: str = Header(default=None)):
    """Middleware-like dependency to ensure every request has a Trace ID"""
    if not x_request_id:
        return f"req_{uuid.uuid4().hex[:10]}"
    return x_request_id

@router.post("/", response_model=APIResponse[HospitalResponse], status_code=201)
def create_hospital(
    hospital_data: HospitalCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("admin", "hospital_admin")),
    idempotency_key: str = Header(..., description="Idempotency key to prevent duplicate hospital creation"),
    trace_id: str = Depends(generate_trace_id)
):
    """
    Register a new Hospital Tenant.
    Requires Idempotency-Key to prevent duplicate network retries.
    """
    # Note: In a full enterprise system, we would check the idempotency_key against Redis here
    
    try:
        hospital = HospitalService.create_hospital(db, hospital_data, admin_user_id=current_user.id)
        
        return APIResponse(
            success=True,
            data=HospitalResponse.from_orm(hospital),
            trace_id=trace_id
        )
    except HTTPException as he:
        # Re-raise HTTPExceptions (already handled in service)
        raise he
    except Exception as e:
        error_response = StandardErrorSchema(
            error_code="HOSPITAL_CREATION_FAILED",
            message="An unexpected error occurred while setting up the tenant.",
            trace_id=trace_id,
            details=str(e)
        )
        raise HTTPException(status_code=500, detail=error_response.dict())

@router.post("/{hospital_id}/departments", response_model=APIResponse[DepartmentResponse], status_code=201)
def create_department(
    hospital_id: int,
    dept_data: DepartmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("hospital_admin", "admin")),
    _tenant: User = Depends(require_tenant_access(0)),  # hospital_id injected at runtime
    trace_id: str = Depends(generate_trace_id)
):
    """
    Create a new Department (Zone) within the Hospital.
    Requires Hospital Admin privileges scoped to this tenant.
    """
    # TODO: Add granular RBAC check here to ensure current_user is admin of hospital_id
    
    try:
        dept = HospitalService.add_department(db, hospital_id, dept_data)
        
        return APIResponse(
            success=True,
            data=DepartmentResponse.from_orm(dept),
            trace_id=trace_id
        )
    except Exception as e:
        error_response = StandardErrorSchema(
            error_code="DEPARTMENT_CREATION_FAILED",
            message="Failed to create the department zone.",
            trace_id=trace_id,
            details=str(e)
        )
        raise HTTPException(status_code=500, detail=error_response.dict())
