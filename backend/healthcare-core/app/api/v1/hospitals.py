"""
Hospital API Routes

Endpoints:
    POST   /hospitals/              - Register a new hospital (hospital_admin, admin)
    GET    /hospitals/              - List all hospitals (admin)
    GET    /hospitals/{id}          - Get hospital details (any authenticated)
    PUT    /hospitals/{id}          - Update hospital (owner hospital_admin, admin)
    DELETE /hospitals/{id}          - Soft-delete hospital (admin only)
"""
import uuid
from datetime import timezone, datetime
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload
from app.models.hospital import Hospital, HospitalStatus
from app.schemas.hospital import HospitalCreate, HospitalUpdate, HospitalResponse, HospitalListResponse
from shared.utils.responses import success_response, error_response

router = APIRouter()


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_hospital(
    payload: HospitalCreate,
    current_user: Annotated[TokenPayload, Depends(require_role("hospital_admin", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    """Register a new hospital. Only hospital_admin or admin can do this."""
    # Check for duplicate registration number
    existing = await db.execute(
        select(Hospital).where(Hospital.registration_number == payload.registration_number)
    )
    if existing.scalars().first():
        return error_response("DUPLICATE_HOSPITAL", "A hospital with this registration number already exists.", 409)

    hospital = Hospital(
        **payload.model_dump(),
        owner_user_id=uuid.UUID(current_user.sub),
        status=HospitalStatus.pending_verification,
    )
    db.add(hospital)
    await db.flush()
    await db.refresh(hospital)

    return success_response(
        data=HospitalResponse.model_validate(hospital).model_dump(mode="json"),
        message="Hospital registered successfully. Pending verification.",
        status_code=201,
    )


@router.get("/")
async def list_hospitals(
    current_user: Annotated[TokenPayload, Depends(require_role("admin"))],
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    city: str = Query(None),
    status_filter: HospitalStatus = Query(None, alias="status"),
):
    """List all hospitals. Admin-only. Supports pagination and filtering."""
    query = select(Hospital).where(Hospital.deleted_at.is_(None))
    if city:
        query = query.where(Hospital.city.ilike(f"%{city}%"))
    if status_filter:
        query = query.where(Hospital.status == status_filter)

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = query.offset((page - 1) * page_size).limit(page_size).order_by(Hospital.created_at.desc())
    result = await db.execute(query)
    hospitals = result.scalars().all()

    return success_response(data=HospitalListResponse(
        total=total, page=page, page_size=page_size,
        items=[HospitalResponse.model_validate(h) for h in hospitals],
    ).model_dump(mode="json"))


@router.get("/{hospital_id}")
async def get_hospital(
    hospital_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get a specific hospital. Any authenticated user can view."""
    result = await db.execute(
        select(Hospital).where(Hospital.id == hospital_id, Hospital.deleted_at.is_(None))
    )
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    return success_response(data=HospitalResponse.model_validate(hospital).model_dump(mode="json"))


@router.put("/{hospital_id}")
async def update_hospital(
    hospital_id: uuid.UUID,
    payload: HospitalUpdate,
    current_user: Annotated[TokenPayload, Depends(require_role("hospital_admin", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    """Update hospital info. Owner or admin only."""
    result = await db.execute(
        select(Hospital).where(Hospital.id == hospital_id, Hospital.deleted_at.is_(None))
    )
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    # Non-admin users can only update their own hospital
    if current_user.role != "admin" and str(hospital.owner_user_id) != current_user.sub:
        raise HTTPException(status_code=403, detail="You can only update your own hospital")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(hospital, field, value)

    await db.flush()
    await db.refresh(hospital)
    return success_response(data=HospitalResponse.model_validate(hospital).model_dump(mode="json"))


@router.delete("/{hospital_id}", status_code=status.HTTP_200_OK)
async def delete_hospital(
    hospital_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role("admin"))],
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a hospital. Admin only."""
    result = await db.execute(
        select(Hospital).where(Hospital.id == hospital_id, Hospital.deleted_at.is_(None))
    )
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    hospital.deleted_at = datetime.now(timezone.utc)
    hospital.is_active = False
    await db.flush()
    return success_response(message="Hospital deactivated successfully.")
