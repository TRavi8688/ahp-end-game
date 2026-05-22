from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas import schemas
from app.services.patient_service import PatientService
from app.api.deps import get_db_user
from app.models.core import User

router = APIRouter(prefix="/profile", tags=["Onboarding"])

@router.post("/setup-patient", response_model=schemas.PatientResponse)
@router.post("/setup", response_model=schemas.PatientResponse)
async def setup_patient_profile(
    data: schemas.PatientCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_db_user) # Secure: Only the logged in user can setup their profile
):
    """Secure patient onboarding via Service layer."""
    service = PatientService(db)
    try:
        # Update User first name/last name
        current_user.first_name = data.first_name
        current_user.last_name = data.last_name
        
        # In a real enterprise app, we'd ensure data.phone_number matches user.email if phone-as-id is used
        patient = await service.setup_profile(data, user_id=current_user.id)
        
        await db.commit()
        return patient
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Profile setup failed: {str(e)}"
        )
