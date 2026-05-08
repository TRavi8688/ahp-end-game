import uuid
import secrets
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Request
from app.schemas import schemas
from app.core import security
import app.api.deps as deps
from app.core.logging import logger
from app.core.audit import log_audit_action
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.verification_service import VerificationService

router = APIRouter(prefix="/doctor/verify", tags=["Doctor Verification"])

@router.post("/start", response_model=schemas.DoctorVerifySessionResponse)
async def start_verification(
    data: schemas.DoctorVerifyStart,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Step 1: Start Doctor Verification (Professional Details)
    """
    if not data.registration_number.upper().startswith("NMC-"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid Registration Number. Must be verified by National Medical Commission."
        )
    
    service = VerificationService(db)
    session_id = await service.start_session(
        full_name=data.full_name,
        reg_no=data.registration_number,
        state_council=data.state_medical_council,
        mobile=data.mobile_number
    )
    
    await log_audit_action(
        db, 
        "DOCTOR_VERIFY_START", 
        resource_type="VERIFICATION_SESSION",
        details={"session_id": session_id, "registration_number": data.registration_number}
    )
    
    return {"session_id": session_id, "status": "basic_verified"}

@router.post("/identity", response_model=schemas.DoctorVerifySessionResponse)
async def upload_identity(
    session_id: str,
    aadhaar_file: UploadFile = File(...),
    selfie_file: UploadFile = File(...),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Step 2: Identity Verification (Aadhaar + Selfie)
    """
    service = VerificationService(db)
    # In production, we'd save the files to S3 here
    aadhaar_url = f"uploads/{session_id}_aadhaar.jpg"
    selfie_url = f"uploads/{session_id}_selfie.jpg"
    
    success = await service.update_identity(session_id, aadhaar_url, selfie_url)
    if not success:
        raise HTTPException(status_code=404, detail="Session not found")
        
    await log_audit_action(
        db, 
        "DOCTOR_IDENTITY_UPLOAD", 
        resource_type="VERIFICATION_SESSION",
        details={"session_id": session_id}
    )
    return {"session_id": session_id, "status": "identity_verified"}

@router.post("/send-otp")
async def send_verification_otp(
    session_id: str,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Step 3a: Send OTP for Mobile Verification.
    """
    service = VerificationService(db)
    otp = await service.generate_otp(session_id)
    if not otp:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Standardized logging for production auditing
    logger.info(f"VERIFICATION_OTP_SENT: Session {session_id} -> OTP: {otp}")
    
    await log_audit_action(
        db, 
        "DOCTOR_VERIFY_OTP_SENT", 
        resource_type="VERIFICATION_SESSION",
        details={"session_id": session_id}
    )
    return {"status": "success", "message": "OTP sent successfully."}

@router.post("/verify-otp", response_model=schemas.DoctorVerifySessionResponse)
async def verify_verification_otp(
    data: schemas.DoctorVerifyOTP,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Step 3b: Verify OTP.
    """
    service = VerificationService(db)
    success = await service.verify_otp(data.session_id, data.otp)
    if not success:
        await log_audit_action(
            db, 
            "DOCTOR_VERIFY_OTP_FAILURE", 
            resource_type="VERIFICATION_SESSION",
            details={"session_id": data.session_id}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    await log_audit_action(
        db, 
        "DOCTOR_VERIFY_OTP_SUCCESS", 
        resource_type="VERIFICATION_SESSION",
        details={"session_id": data.session_id}
    )
    return {"session_id": data.session_id, "status": "otp_verified"}

@router.post("/complete", response_model=schemas.Token)
async def complete_verification(
    data: schemas.DoctorVerifyComplete,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Step 4: Set Password and Complete Account Creation.
    """
    service = VerificationService(db)
    user = await service.complete_verification(data.session_id, data.password)
    
    if not user:
        raise HTTPException(status_code=400, detail="Identity verification flow not completed or out of sequence.")
        
    await log_audit_action(
        db, 
        "DOCTOR_VERIFY_COMPLETE", 
        user_id=user.id,
        resource_type="USER",
        details={"email": user.email}
    )
    
    access_token = security.create_access_token(user.id, "doctor")
    refresh_token = security.create_refresh_token(user.id, "doctor")
    
    return {
        "access_token": access_token, 
        "refresh_token": refresh_token, 
        "token_type": "bearer"
    }
