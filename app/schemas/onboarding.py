from pydantic import BaseModel, EmailStr
from typing import Optional, List
import uuid

class HospitalRegister(BaseModel):
    name: str
    registration_number: str
    staff_count: int
    owner_email: EmailStr

class HospitalOnboardingStatus(BaseModel):
    id: uuid.UUID
    hospyn_id: str
    verification_status: str
    is_approved: bool
    certificate_url: Optional[str] = None

    class Config:
        from_attributes = True

class StaffAdd(BaseModel):
    full_name: str
    email: EmailStr
    role: str # doctor, nurse, admin, hr

class PaymentVerify(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
