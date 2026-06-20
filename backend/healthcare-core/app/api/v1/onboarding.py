"""
backend/healthcare-core/app/api/v1/onboarding.py

All endpoints called by ActivationWizard.jsx and QuickRegister.jsx.

  POST /onboarding/register-enterprise
  POST /onboarding/send-government-pan-otp/{id}
  POST /onboarding/verify-government-pan-otp/{id}
  POST /onboarding/generate-razorpay-qr/{id}
  POST /onboarding/submit-upi-vpa/{id}
  POST /onboarding/submit-card-payment/{id}
  POST /onboarding/verify-card-otp/{id}
  POST /onboarding/admin-approve-hospital/{id}
  GET  /onboarding/hospital-status/{id}
  GET  /onboarding/hospital-public-info/{id}
  POST /walkin/public/quick-register
"""

from __future__ import annotations

import logging
import os
import random
import secrets
import string
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.hospital import Hospital, HospitalStatus

logger = logging.getLogger(__name__)

router              = APIRouter()
walkin_public_router = APIRouter()

# ── In-memory OTP store (replace with Redis in production) ────────────────────
# { hospital_id: { "govt_otp": "123456", "bank_otp": "654321" } }
_otp_store: dict[str, dict] = {}


def _otp(length: int = 6) -> str:
    return "".join(random.choices(string.digits, k=length))


def _hospyn_id(name: str) -> str:
    prefix = "".join(c.upper() for c in name if c.isalpha())[:4].ljust(4, "H")
    return f"HOSP-{prefix}-{random.randint(1000, 9999)}"


async def _hospital_or_404(db: AsyncSession, hospital_id: str) -> Hospital:
    try:
        uid = uuid.UUID(hospital_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid hospital_id — must be a UUID")
    result = await db.execute(select(Hospital).where(Hospital.id == uid))
    h = result.scalars().first()
    if not h:
        raise HTTPException(status_code=404, detail=f"Hospital {hospital_id} not found")
    return h


# ── 1. Register enterprise ────────────────────────────────────────────────────

@router.post("/register-enterprise", status_code=201)
async def register_enterprise(
    background:          BackgroundTasks,
    name:                str           = Form(...),
    registration_number: str           = Form(...),
    owner_email:         str           = Form(...),
    owner_password:      str           = Form(...),
    phone_number:        str           = Form(...),
    physical_address:    str           = Form(...),
    pan_number:          str           = Form(...),
    staff_count:         str           = Form("1"),
    latitude:            Optional[str] = Form(None),
    longitude:           Optional[str] = Form(None),
    branches:            Optional[str] = Form(None),
    branch_locations:    Optional[str] = Form(None),
    payment_method_type: str           = Form("upi"),
    upi_id:              Optional[str] = Form(None),
    payment_token:       Optional[str] = Form(None),
    certificate:         Optional[UploadFile] = File(None),
    pan_card_photo:      Optional[UploadFile] = File(None),
    selfie:              Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
):
    # Duplicate check
    dup = await db.execute(
        text("SELECT id FROM hospitals WHERE registration_number = :rn LIMIT 1"),
        {"rn": registration_number},
    )
    if dup.first():
        raise HTTPException(
            status_code=409,
            detail="A hospital with this registration number already exists.",
        )

    # Parse city/state from address
    parts    = [p.strip() for p in physical_address.split(",")]
    city     = parts[-3] if len(parts) >= 3 else (parts[0] if parts else "Unknown")
    state    = parts[-2] if len(parts) >= 2 else "Unknown"
    pin_code = parts[-1] if parts else "000000"

    hospital_id = uuid.uuid4()
    hospyn_id   = _hospyn_id(name)

    hospital = Hospital(
        id=hospital_id,
        name=name,
        registration_number=registration_number,
        email=owner_email,
        phone=phone_number,
        address_line1=physical_address,
        city=city,
        state=state,
        country="India",
        pin_code=pin_code,
        status=HospitalStatus.pending_verification,
        owner_user_id=uuid.uuid4(),  # replaced once auth-service creates the user
    )
    db.add(hospital)

    # Save uploads to GCS (async, non-blocking)
    files_to_upload = [
        (certificate,    "certificate"),
        (pan_card_photo, "pan_card"),
        (selfie,         "selfie"),
    ]
    for upload, label in files_to_upload:
        if upload:
            try:
                contents = await upload.read()
                background.add_task(
                    _upload_to_gcs,
                    str(hospital_id), label, upload.filename, contents,
                )
            except Exception as e:
                logger.warning("File read failed for %s: %s", label, e)

    await db.flush()
    await db.refresh(hospital)

    logger.info(
        "Hospital registered",
        extra={"hospital_id": str(hospital_id), "hospyn_id": hospyn_id, "name": name},
    )

    return {
        "hospital_id": str(hospital.id),
        "hospyn_id":   hospyn_id,
        "resolved_pan": pan_number.strip().upper(),
        "status":       hospital.status,
        "message":      "Hospital registered. Proceed to government OTP verification.",
    }


async def _upload_to_gcs(hospital_id: str, label: str, filename: str, contents: bytes):
    """Upload document to GCS. Logs in dev, actually uploads in production."""
    bucket = os.getenv("GCP_STORAGE_BUCKET")
    if not bucket:
        logger.info("[DEV] GCS upload skipped — %s for hospital %s (%d bytes)", label, hospital_id, len(contents))
        return
    try:
        from google.cloud import storage
        client = storage.Client()
        blob   = client.bucket(bucket).blob(f"hospitals/{hospital_id}/{label}/{filename}")
        blob.upload_from_string(contents)
        logger.info("Uploaded %s for hospital %s to GCS", label, hospital_id)
    except Exception as e:
        logger.error("GCS upload failed for %s: %s", label, e)


# ── 2. Send govt PAN OTP ──────────────────────────────────────────────────────

@router.post("/send-government-pan-otp/{hospital_id}")
async def send_government_pan_otp(
    hospital_id: str,
    db: AsyncSession = Depends(get_db),
):
    hospital = await _hospital_or_404(db, hospital_id)
    otp = _otp()
    _otp_store[hospital_id] = {**_otp_store.get(hospital_id, {}), "govt_otp": otp}

    # Production: Twilio SMS
    await _send_sms(hospital.phone, f"[Hospin] Your PAN verification OTP is {otp}. Valid for 10 minutes.")

    logger.info("Govt OTP sent for hospital %s (phone ending %s)", hospital_id, hospital.phone[-2:])
    return {
        "message":       f"OTP sent to {hospital.phone[:4]}****{hospital.phone[-2:]}",
        "simulated_otp": otp,   # Remove this line in production
    }


# ── 3. Verify govt PAN OTP ────────────────────────────────────────────────────

@router.post("/verify-government-pan-otp/{hospital_id}")
async def verify_government_pan_otp(
    hospital_id: str,
    otp_code:    str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    await _hospital_or_404(db, hospital_id)
    stored = _otp_store.get(hospital_id, {}).get("govt_otp")
    if not stored or otp_code.strip() != stored:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP. Request a new one.")
    logger.info("Govt OTP verified for hospital %s", hospital_id)
    return {"message": "OTP verified successfully."}


# ── 4a. Generate Razorpay UPI QR ─────────────────────────────────────────────

@router.post("/generate-razorpay-qr/{hospital_id}")
async def generate_razorpay_qr(
    hospital_id: str,
    db: AsyncSession = Depends(get_db),
):
    await _hospital_or_404(db, hospital_id)
    ref     = secrets.token_hex(8).upper()
    vpa     = os.getenv("HOSPYN_UPI_VPA", "hospin@razorpay")
    uri     = f"upi://pay?pa={vpa}&pn=Hospin&am=2.00&cu=INR&tn=SecurityHold-{ref}"

    # Production: use Razorpay QR Code API to get a real scannable QR
    logger.info("UPI QR generated for hospital %s ref=%s", hospital_id, ref)
    return {"upi_intent_uri": uri, "reference_id": ref, "amount": "2.00", "currency": "INR"}


# ── 4b. Submit UPI VPA (collect request) ──────────────────────────────────────

@router.post("/submit-upi-vpa/{hospital_id}")
async def submit_upi_vpa(
    hospital_id: str,
    upi_id:      str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    await _hospital_or_404(db, hospital_id)
    if "@" not in upi_id:
        raise HTTPException(status_code=400, detail="Invalid UPI ID format.")
    # Production: Razorpay collect API
    logger.info("UPI collect sent to %s for hospital %s", upi_id, hospital_id)
    return {"message": f"Collect request sent to {upi_id}. Approve ₹2 in your UPI app.", "status": "pending"}


# ── 4c. Submit card payment ───────────────────────────────────────────────────

@router.post("/submit-card-payment/{hospital_id}")
async def submit_card_payment(
    hospital_id: str,
    card_number: str = Form(...),
    card_expiry: str = Form(...),
    card_cvv:    str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    await _hospital_or_404(db, hospital_id)
    digits = card_number.replace(" ", "").replace("-", "")
    if not digits.isdigit() or len(digits) not in (15, 16):
        raise HTTPException(status_code=400, detail="Invalid card number.")

    otp = _otp()
    _otp_store[hospital_id] = {**_otp_store.get(hospital_id, {}), "bank_otp": otp}
    logger.info("Card e-mandate initiated for hospital %s (last4=%s)", hospital_id, digits[-4:])
    return {
        "message":            "Card hold initiated. Check your bank SMS for OTP.",
        "simulated_bank_otp": otp,   # Remove in production
    }


# ── 4d. Verify card OTP ───────────────────────────────────────────────────────

@router.post("/verify-card-otp/{hospital_id}")
async def verify_card_otp(
    hospital_id: str,
    otp_code:    str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    hospital = await _hospital_or_404(db, hospital_id)
    stored   = _otp_store.get(hospital_id, {}).get("bank_otp")
    if not stored or otp_code.strip() != stored:
        raise HTTPException(status_code=400, detail="Invalid bank OTP.")
    hospital.status = HospitalStatus.active
    db.add(hospital)
    await db.flush()
    logger.info("Hospital %s ACTIVATED via card OTP", hospital_id)
    return {"message": "Payment verified. Hospital node is now active!", "status": "active"}


# ── 5a. Admin force-approve ───────────────────────────────────────────────────

@router.post("/admin-approve-hospital/{hospital_id}")
async def admin_approve_hospital(
    hospital_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Dev/superadmin bypass — sets hospital to active."""
    hospital = await _hospital_or_404(db, hospital_id)
    hospital.status = HospitalStatus.active
    db.add(hospital)
    await db.flush()
    logger.info("Hospital %s force-approved by admin", hospital_id)
    return {"message": "Hospital approved and activated.", "status": "active"}


# ── 5b. Hospital status polling ───────────────────────────────────────────────

@router.get("/hospital-status/{hospital_id}")
async def get_hospital_status(
    hospital_id: str,
    db: AsyncSession = Depends(get_db),
):
    hospital    = await _hospital_or_404(db, hospital_id)
    is_approved = hospital.status == HospitalStatus.active
    return {
        "hospital_id":         str(hospital.id),
        "name":                hospital.name,
        "verification_status": "completed" if is_approved else "pending",
        "is_approved":         is_approved,
        "pan_status":          "verified",
        "payment_status":      "cleared" if is_approved else "pending",
        "status":              hospital.status,
    }


# ── Public: Hospital info for QR scan page ────────────────────────────────────

@router.get("/hospital-public-info/{hospital_id}")
async def hospital_public_info(
    hospital_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Minimal info for patient walk-in QR page — no auth required."""
    hospital = await _hospital_or_404(db, hospital_id)
    if hospital.status != HospitalStatus.active:
        raise HTTPException(status_code=403, detail="This hospital is not yet active on Hospin.")
    return {
        "hospital_name": hospital.name,
        "city":          hospital.city,
        "is_active":     True,
    }


# ── Public: Patient walk-in quick register ────────────────────────────────────

class QuickRegisterPayload(BaseModel):
    hospital_id: str
    name:        str
    phone:       str = "0000000000"
    age:         int
    reason:      str


@walkin_public_router.post("/public/quick-register", status_code=201)
async def walkin_quick_register(
    payload: QuickRegisterPayload,
    db: AsyncSession = Depends(get_db),
):
    """Patient self-registration via QR code. No authentication required."""
    try:
        hosp_uid = uuid.UUID(payload.hospital_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid hospital_id format")

    result = await db.execute(
        text("SELECT id, name, status FROM hospitals WHERE id = :id LIMIT 1"),
        {"id": hosp_uid},
    )
    hospital = result.mappings().first()
    if not hospital or hospital["status"] != "active":
        raise HTTPException(status_code=404, detail="Hospital not found or not active.")

    parts      = payload.name.strip().split(" ", 1)
    first_name = parts[0]
    last_name  = parts[1] if len(parts) > 1 else ""
    walkin_id  = uuid.uuid4()
    queue_num  = random.randint(100, 999)
    now        = datetime.now(timezone.utc)

    await db.execute(
        text("""
            INSERT INTO walk_in_requests
              (id, hospital_id, first_name, last_name, phone, age,
               reason_for_visit, queue_state, queue_number, source, created_at, updated_at)
            VALUES
              (:id, :hosp_id, :fn, :ln, :phone, :age,
               :reason, 'waiting_reception', :qnum, 'qr_scan', :now, :now)
        """),
        {
            "id": walkin_id, "hosp_id": hosp_uid,
            "fn": first_name, "ln": last_name,
            "phone": payload.phone, "age": payload.age,
            "reason": payload.reason, "qnum": queue_num, "now": now,
        },
    )
    await db.flush()

    logger.info("Walk-in registered hospital=%s queue=%s", payload.hospital_id, queue_num)
    return {
        "walkin_id":    str(walkin_id),
        "queue_number": queue_num,
        "status":       "waiting_reception",
        "message":      "You're in the queue. Please take a seat.",
    }


# ── Twilio SMS helper ─────────────────────────────────────────────────────────

async def _send_sms(to: str, body: str):
    """Send SMS via Twilio. Logs in dev if credentials not set."""
    sid   = os.getenv("TWILIO_ACCOUNT_SID")
    token = os.getenv("TWILIO_AUTH_TOKEN")
    from_ = os.getenv("TWILIO_PHONE_FROM")
    if not all([sid, token, from_]):
        logger.info("[DEV] SMS to %s: %s", to, body)
        return
    try:
        from twilio.rest import Client
        Client(sid, token).messages.create(to=to, from_=from_, body=body)
    except Exception as e:
        logger.error("Twilio SMS failed to %s: %s", to, e)
