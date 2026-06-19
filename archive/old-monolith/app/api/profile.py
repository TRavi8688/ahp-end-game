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

@router.put("/status", response_model=schemas.UserResponse)
async def update_staff_status(
    data: schemas.StaffStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_db_user)
):
    # Only admins can set ON_LEAVE or OFF_DUTY
    if data.status in ["ON_LEAVE", "OFF_DUTY"]:
        role_str = str(current_user.role.value) if hasattr(current_user.role, 'value') else str(current_user.role)
        if role_str not in ["hospital_admin", "admin"]:
            raise HTTPException(
                status_code=403, 
                detail="Only Hospital Administrators can set ON_LEAVE or OFF_DUTY statuses. Please contact HR."
            )
            
    current_user.current_status = data.status
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.put("/profile", response_model=schemas.UserResponse)
async def update_profile(
    data: schemas.ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_db_user)
):
    if data.first_name is not None:
        current_user.first_name = data.first_name
    if data.last_name is not None:
        current_user.last_name = data.last_name
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.put("/password", response_model=schemas.UserResponse)
async def update_password(
    data: schemas.PasswordUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_db_user)
):
    from app.core.security import verify_password, get_password_hash
    if not verify_password(data.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect password")
    current_user.hashed_password = get_password_hash(data.new_password)
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.post("/photo", response_model=schemas.UserResponse)
async def update_profile_photo(
    # In a real system, this would accept an UploadFile and upload to S3.
    # For now, we mock receiving a URL or base64 from a client service.
    # We will simulate the URL update for the demo.
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_db_user)
):
    # Simulated S3 upload result
    current_user.profile_photo_url = f"https://ui-avatars.com/api/?name={current_user.first_name}+{current_user.last_name}"
    await db.commit()
    await db.refresh(current_user)
    return current_user

@router.post("/phone/request-otp", response_model=dict)
async def request_phone_otp(
    data: schemas.PhoneOTPRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_db_user)
):
    # Actual OTP generation
    import secrets
    otp = "".join([str(secrets.randbelow(10)) for _ in range(6)])
    from app.models.models import OTPVerification
    from datetime import datetime, timezone, timedelta
    
    new_otp = OTPVerification(
        identifier=data.phone_number,
        otp=otp,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=5)
    )
    db.add(new_otp)
    await db.commit()
    
    from app.services.two_factor_service import send_sms_otp
    success = await send_sms_otp(data.phone_number, otp)
    if not success:
        raise HTTPException(status_code=400, detail="Failed to send OTP via Twilio.")
        
    return {"message": "OTP sent to new phone number successfully"}

@router.post("/phone/verify-otp", response_model=schemas.UserResponse)
async def verify_phone_otp(
    data: schemas.PhoneOTPVerify,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_db_user)
):
    from app.models.models import OTPVerification
    from sqlalchemy import select
    from datetime import datetime, timezone

    result = await db.execute(
        select(OTPVerification)
        .where(OTPVerification.identifier == data.phone_number)
        .where(OTPVerification.expires_at > datetime.now(timezone.utc))
        .order_by(OTPVerification.created_at.desc())
    )
    otp_record = result.scalars().first()
    
    if not otp_record or otp_record.otp != data.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    current_user.email = data.phone_number  # The system uses email column for phone/email
    await db.commit()
    await db.refresh(current_user)
    return current_user

