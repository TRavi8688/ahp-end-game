from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
import uuid
from datetime import datetime, timezone

from app.core.database import get_db
from app.models.models import Hospital, User, VerificationStatusEnum
from app.models.onboarding_request import StaffOnboardingRequest
from app.schemas.onboarding import HospitalRegister, HospitalOnboardingStatus, StaffAdd, PaymentVerify
from app.services.payment import payment_service

router = APIRouter()

@router.post("/register", response_model=HospitalOnboardingStatus)
async def register_hospital(
    name: str = Form(...),
    registration_number: str = Form(...),
    staff_count: int = Form(...),
    owner_email: str = Form(...),
    certificate: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Step 1: Hospital Owner registers their hospital.
    Initial status: pending
    """
    # Save certificate
    certificate_path = f"uploads/certificates/{uuid.uuid4()}_{certificate.filename}"
    with open(certificate_path, "wb") as f:
        f.write(await certificate.read())

    new_hospital = Hospital(
        name=name,
        registration_number=registration_number,
        staff_count=staff_count,
        hospyn_id=f"HOS-{uuid.uuid4().hex[:6].upper()}",
        short_code=name[:3].upper(),
        verification_status=VerificationStatusEnum.pending,
        certificate_url=certificate_path # Store the path
    )
    
    db.add(new_hospital)
    await db.commit()
    await db.refresh(new_hospital)
    
    return new_hospital

@router.post("/verify/{hospital_id}")
async def verify_hospital(
    hospital_id: uuid.UUID,
    approve: bool,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 2: Super Admin (You) approves or rejects the hospital request.
    """
    stmt = select(Hospital).where(Hospital.id == hospital_id)
    result = await db.execute(stmt)
    hospital = result.scalar_one_or_none()
    
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    
    if approve:
        hospital.verification_status = "verified_awaiting_payment"
    else:
        hospital.verification_status = "rejected"
        
    await db.commit()
    return {"status": hospital.verification_status}

@router.post("/initiate-payment/{hospital_id}")
async def initiate_payment(
    hospital_id: uuid.UUID,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 3: Hospital Owner initiates the ₹1 verification fee.
    Returns Razorpay Order ID.
    """
    stmt = select(Hospital).where(Hospital.id == hospital_id)
    result = await db.execute(stmt)
    hospital = result.scalar_one_or_none()
    
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
        
    order = payment_service.create_verification_order(str(hospital_id), amount=100) # ₹1 = 100 paise
    if not order:
        raise HTTPException(status_code=500, detail="Failed to create payment order")
        
    return order

@router.post("/verify-payment/{hospital_id}")
async def verify_payment(
    hospital_id: uuid.UUID,
    data: PaymentVerify,
    db: AsyncSession = Depends(get_db)
):
    """
    Step 4: Verify Razorpay payment signature and finalize approval.
    """
    # Verify Signature
    is_valid = payment_service.verify_payment_signature(
        data.razorpay_order_id,
        data.razorpay_payment_id,
        data.razorpay_signature
    )
    
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    stmt = select(Hospital).where(Hospital.id == hospital_id)
    result = await db.execute(stmt)
    hospital = result.scalar_one_or_none()
    
    hospital.payment_status = "paid"
    hospital.verification_status = "approved"
    hospital.is_approved = True
    
    await db.commit()
    
    # Staff Count Logic for Portal Links
    portal_links = []
    if hospital.staff_count <= 5:
        portal_links.append("https://staff.hospyn.com")
    else:
        portal_links.append("https://hr.hospyn.com")
        portal_links.append("https://admin.hospyn.com")
        
    return {
        "message": "Hospital approved and access granted.",
        "portal_links": portal_links
    }

@router.post("/add-staff/{hospital_id}")
async def add_staff(
    hospital_id: uuid.UUID,
    staff_list: List[StaffAdd],
    db: AsyncSession = Depends(get_db)
):
    """
    Step 4: Hospital Owner adds their staff members.
    System will send individual access mails.
    """
    for staff in staff_list:
        new_request = StaffOnboardingRequest(
            hospital_id=hospital_id,
            full_name=staff.full_name,
            email=staff.email,
            role=staff.role
        )
        db.add(new_request)
        
        # In a real app, you'd trigger a background task to send emails
        # generate_staff_credentials_and_email.delay(new_request.id)
        
    await db.commit()
    return {"message": f"Successfully added {len(staff_list)} staff members. Credentials will be mailed."}
