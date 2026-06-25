"""
backend/healthcare-core/app/api/v1/patient_mobile_api.py

Provides every endpoint the HOSPAIN patient mobile app calls that previously
404'd because nginx only routed /api/v1/healthcare/* but the patient-app
called /api/v1/patient/* and /api/v1/profile/* directly.

nginx now rewrites those paths to /api/v1/healthcare/patient/* and
/api/v1/healthcare/profile/* so everything lands here.

Endpoints (all under /patient or /profile prefix, mounted in router.py):
  POST /patient/login-hospyn       - login with HOSPAIN ID (hospyn_id) instead of email/phone
  GET  /patient/profile            - get the logged-in patient's full profile
  POST /profile/setup              - first-time profile setup after OTP registration
  GET  /patient/records            - patient's medical records list
  GET  /patient/clinical-summary   - AI clinical summary for the patient
  GET  /patient/active-sharing     - which hospitals the patient has shared records with
  POST /patient/share-record       - share prescription/record with a pharmacy QR
  DELETE /patient/revoke-access/{id} - revoke a pharmacy's access to shared records
  POST /patient/chat               - AI health chat (proxies to ai-service)
"""

import uuid
import re
import httpx
import logging
from datetime import datetime
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user, TokenPayload
from app.models.patient import Patient, Gender
from app.models.prescription import Prescription
from app.models.pharmacy import PrescriptionShare
from app.models.hospital import Hospital
from app.config.settings import settings

logger = logging.getLogger(__name__)

patient_router = APIRouter()
profile_router = APIRouter()

HOSPAIN_ID_PREFIX = "HSP"

def _generate_hospain_id(name: str, patient_id: uuid.UUID) -> str:
    """Generate a human-readable HOSPAIN ID like HSP-JOHN-4A2F."""
    initials = re.sub(r"[^A-Z]", "", name.upper())[:4] or "USR"
    suffix = str(patient_id).replace("-", "").upper()[:4]
    return f"{HOSPAIN_ID_PREFIX}-{initials}-{suffix}"


def _patient_to_dict(p: Patient) -> dict:
    return {
        "id": str(p.id),
        "hospain_id": p.hospyn_id or "",
        "hospyn_id": p.hospyn_id or "",
        "first_name": p.first_name,
        "last_name": p.last_name,
        "full_name": f"{p.first_name} {p.last_name}",
        "email": p.email or "",
        "phone": p.phone or "",
        "date_of_birth": p.date_of_birth.isoformat() if p.date_of_birth else None,
        "gender": p.gender.value if p.gender else None,
        "blood_group": p.blood_group.value if p.blood_group else None,
        "address": p.address or "",
        "city": p.city or "",
        "state": p.state or "",
        "pin_code": p.pin_code or "",
    }


# ── POST /patient/login-hospyn ────────────────────────────────────────────────

class LoginHospainRequest(BaseModel):
    hospain_id: Optional[str] = None
    hospyn_id: Optional[str] = None   # alias
    password: Optional[str] = None    # not used for OTP patients, kept for compat

@patient_router.post("/login-hospyn")
async def login_hospain(
    payload: LoginHospainRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Patient-app calls this to look up a patient's profile by their HOSPAIN ID
    after they've already authenticated via OTP (so they have a valid JWT but
    no patient row yet in this service). Returns the patient record for the
    HOSPAIN ID entered on the login screen, so the patient-app can display
    their profile. This does NOT issue a new token — the OTP token is still valid.
    """
    hid = payload.hospain_id or payload.hospyn_id or ""
    if not hid:
        raise HTTPException(status_code=422, detail="hospain_id is required")

    result = await db.execute(
        select(Patient).where(Patient.hospyn_id == hid, Patient.deleted_at.is_(None))
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(
            status_code=404,
            detail=f"No HOSPAIN patient found with ID '{hid}'. Check the ID and try again.",
        )

    return {"patient": _patient_to_dict(patient)}


# ── GET /patient/profile ──────────────────────────────────────────────────────

@patient_router.get("/profile")
async def get_patient_profile(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the logged-in patient's HOSPAIN profile. The patient-app calls
    this immediately after login/OTP to hydrate the home screen.
    """
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub),
            Patient.deleted_at.is_(None),
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not set up yet. Complete profile setup first.",
        )
    return {"patient": _patient_to_dict(patient)}


# ── POST /profile/setup ───────────────────────────────────────────────────────

class ProfileSetupRequest(BaseModel):
    first_name: str
    last_name: str
    date_of_birth: Optional[str] = None
    gender: Optional[str] = None
    blood_group: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pin_code: Optional[str] = None

@profile_router.post("/setup")
async def setup_profile(
    payload: ProfileSetupRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Called after OTP verification when is_new_user=True.
    Creates the Patient row and assigns a HOSPAIN ID (hospyn_id).
    The patient-app routes new users to this screen before the main app.
    """
    user_uuid = uuid.UUID(current_user.sub)

    # Idempotent — if profile already exists, return it
    existing = await db.execute(
        select(Patient).where(Patient.user_id == user_uuid, Patient.deleted_at.is_(None))
    )
    patient = existing.scalars().first()
    if patient:
        return {"patient": _patient_to_dict(patient), "already_existed": True}

    new_id = uuid.uuid4()
    hospain_id = _generate_hospain_id(
        f"{payload.first_name}{payload.last_name}", new_id
    )

    dob = None
    if payload.date_of_birth:
        try:
            dob = datetime.fromisoformat(payload.date_of_birth.replace("Z", "+00:00")).date()
        except ValueError:
            pass

    gender_enum = None
    if payload.gender:
        try:
            gender_enum = Gender(payload.gender.lower())
        except ValueError:
            pass

    patient = Patient(
        id=new_id,
        user_id=user_uuid,
        hospyn_id=hospain_id,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=current_user.email if hasattr(current_user, "email") else None,
        phone=current_user.phone if hasattr(current_user, "phone") else None,
        date_of_birth=dob,
        gender=gender_enum,
        address=payload.address,
        city=payload.city,
        state=payload.state,
        pin_code=payload.pin_code,
        is_active=True,
    )
    db.add(patient)
    await db.flush()
    await db.refresh(patient)

    return {"patient": _patient_to_dict(patient), "already_existed": False}


# ── GET /patient/records ──────────────────────────────────────────────────────

@patient_router.get("/records")
async def get_patient_records(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Patient's medical records and prescriptions."""
    patient_result = await db.execute(
        select(Patient).where(Patient.user_id == uuid.UUID(current_user.sub))
    )
    patient = patient_result.scalars().first()
    if not patient:
        return {"records": [], "prescriptions": []}

    rx_result = await db.execute(
        select(Prescription)
        .options(selectinload(Prescription.items))
        .where(Prescription.patient_id == patient.id)
        .order_by(Prescription.created_at.desc())
        .limit(50)
    )
    prescriptions = rx_result.scalars().all()

    return {
        "records": [],  # Lab/imaging records — lab_results module (stub) owns these
        "prescriptions": [
            {
                "id": str(rx.id),
                "status": rx.status,
                "created_at": rx.created_at.isoformat() if rx.created_at else None,
                "image_url": rx.image_url,
                "medications": [
                    {"name": item.drug_name, "dosage": item.dosage,
                     "frequency": item.frequency, "duration": item.duration}
                    for item in (rx.items or [])
                ],
            }
            for rx in prescriptions
        ],
    }


# ── GET /patient/active-sharing ───────────────────────────────────────────────

@patient_router.get("/active-sharing")
async def get_active_sharing(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Which pharmacies the patient has active (not rejected/revoked) shares with."""
    patient_result = await db.execute(
        select(Patient).where(Patient.user_id == uuid.UUID(current_user.sub))
    )
    patient = patient_result.scalars().first()
    if not patient:
        return {"shares": []}

    # Get all prescriptions for this patient
    rx_result = await db.execute(
        select(Prescription.id).where(Prescription.patient_id == patient.id)
    )
    rx_ids = [row[0] for row in rx_result.fetchall()]
    if not rx_ids:
        return {"shares": []}

    shares_result = await db.execute(
        select(PrescriptionShare)
        .options(selectinload(PrescriptionShare.prescription))
        .where(
            PrescriptionShare.prescription_id.in_(rx_ids),
            PrescriptionShare.status.notin_(["rejected", "revoked"]),
        )
        .order_by(PrescriptionShare.shared_at.desc())
    )
    shares = shares_result.scalars().all()

    # Fetch pharmacy (hospital) names
    hospital_ids = list({s.pharmacy_hospital_id for s in shares})
    hospitals = {}
    if hospital_ids:
        h_result = await db.execute(
            select(Hospital).where(Hospital.id.in_(hospital_ids))
        )
        hospitals = {h.id: h for h in h_result.scalars().all()}

    return {
        "shares": [
            {
                "id": str(s.id),
                "pharmacy_id": str(s.pharmacy_hospital_id),
                "pharmacy_name": hospitals.get(s.pharmacy_hospital_id, None) and
                                 hospitals[s.pharmacy_hospital_id].name or "Unknown Pharmacy",
                "status": s.status,
                "shared_at": s.shared_at.isoformat() if s.shared_at else None,
                "prescription_id": str(s.prescription_id),
            }
            for s in shares
        ]
    }


# ── POST /patient/share-record ────────────────────────────────────────────────

class ShareRecordRequest(BaseModel):
    pharmacy_hospital_id: str
    prescription_id: Optional[str] = None  # share a specific Rx; omit to share all active

@patient_router.post("/share-record")
async def share_record(
    payload: ShareRecordRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Patient scans pharmacy QR code → app calls this to share their
    prescription(s) with that pharmacy.
    """
    patient_result = await db.execute(
        select(Patient).where(Patient.user_id == uuid.UUID(current_user.sub))
    )
    patient = patient_result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    try:
        pharmacy_uuid = uuid.UUID(payload.pharmacy_hospital_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid pharmacy_hospital_id.")

    pharmacy_result = await db.execute(select(Hospital).where(Hospital.id == pharmacy_uuid))
    if not pharmacy_result.scalars().first():
        raise HTTPException(status_code=404, detail="Pharmacy not found.")

    if payload.prescription_id:
        try:
            rx_ids = [uuid.UUID(payload.prescription_id)]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid prescription_id.")
    else:
        rx_result = await db.execute(
            select(Prescription.id)
            .where(Prescription.patient_id == patient.id, Prescription.status == "pending")
            .limit(10)
        )
        rx_ids = [row[0] for row in rx_result.fetchall()]

    if not rx_ids:
        raise HTTPException(status_code=400, detail="No active prescriptions to share.")

    created = []
    for rx_id in rx_ids:
        # Don't create duplicates
        existing = await db.execute(
            select(PrescriptionShare).where(
                PrescriptionShare.prescription_id == rx_id,
                PrescriptionShare.pharmacy_hospital_id == pharmacy_uuid,
                PrescriptionShare.status.notin_(["rejected", "revoked", "delivered"]),
            )
        )
        if existing.scalars().first():
            continue
        share = PrescriptionShare(
            id=uuid.uuid4(),
            prescription_id=rx_id,
            pharmacy_hospital_id=pharmacy_uuid,
            status="pending",
        )
        db.add(share)
        created.append(str(share.id))

    await db.flush()
    return {"shared": len(created), "share_ids": created}


# ── DELETE /patient/revoke-access/{access_id} ─────────────────────────────────

@patient_router.delete("/revoke-access/{access_id}")
async def revoke_access(
    access_id: str,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Patient revokes a pharmacy's access to their prescription."""
    patient_result = await db.execute(
        select(Patient).where(Patient.user_id == uuid.UUID(current_user.sub))
    )
    patient = patient_result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    try:
        share_uuid = uuid.UUID(access_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid access_id.")

    share_result = await db.execute(
        select(PrescriptionShare)
        .options(selectinload(PrescriptionShare.prescription))
        .where(PrescriptionShare.id == share_uuid)
    )
    share = share_result.scalars().first()
    if not share:
        raise HTTPException(status_code=404, detail="Share not found.")

    # Verify this share belongs to the requesting patient
    if share.prescription and share.prescription.patient_id != patient.id:
        raise HTTPException(status_code=403, detail="Not your prescription.")

    if share.status == "delivered":
        raise HTTPException(status_code=400, detail="Cannot revoke a completed order.")

    share.status = "revoked"
    await db.flush()
    return {"revoked": True, "share_id": access_id}


# ── GET /patient/clinical-summary ─────────────────────────────────────────────

@patient_router.get("/clinical-summary")
async def get_clinical_summary(
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """
    Returns an AI-generated health summary. Proxies to ai-service if available;
    falls back to a structured summary from the patient's own records.
    """
    patient_result = await db.execute(
        select(Patient).where(Patient.user_id == uuid.UUID(current_user.sub))
    )
    patient = patient_result.scalars().first()
    if not patient:
        return {"summary": "No patient profile found. Complete your profile setup first."}

    rx_result = await db.execute(
        select(Prescription)
        .options(selectinload(Prescription.items))
        .where(Prescription.patient_id == patient.id)
        .order_by(Prescription.created_at.desc())
        .limit(10)
    )
    prescriptions = rx_result.scalars().all()

    medication_names = list({
        item.drug_name
        for rx in prescriptions
        for item in (rx.items or [])
    })

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            ai_resp = await client.post(
                f"{settings.AI_SERVICE_URL}/clinical/summary",
                json={
                    "patient_name": patient.full_name,
                    "medications": medication_names,
                    "blood_group": patient.blood_group.value if patient.blood_group else None,
                },
                headers={"X-Internal-Service": "healthcare-core"},
            )
        if ai_resp.status_code == 200:
            return ai_resp.json()
    except Exception:
        pass

    # Fallback structured summary
    return {
        "summary": (
            f"Patient: {patient.full_name}\n"
            f"Blood Group: {patient.blood_group.value if patient.blood_group else 'Not recorded'}\n"
            f"Active Medications: {', '.join(medication_names) if medication_names else 'None recorded'}\n"
            f"Recent Prescriptions: {len(prescriptions)}"
        ),
        "medications": medication_names,
        "prescriptions_count": len(prescriptions),
    }


# ── POST /patient/chat ────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    message: str
    history: list = []

@patient_router.post("/chat")
async def patient_chat(
    payload: ChatRequest,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """AI health chat — proxies to ai-service with patient context."""
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=400, detail="message is required.")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            ai_resp = await client.post(
                f"{settings.AI_SERVICE_URL}/clinical/chat",
                json={
                    "message": payload.message,
                    "history": payload.history,
                    "user_id": current_user.sub,
                },
                headers={"X-Internal-Service": "healthcare-core"},
            )
        if ai_resp.status_code == 200:
            return ai_resp.json()
    except Exception as exc:
        logger.error("AI chat proxy failed: %s", exc)

    return {
        "reply": (
            "I'm having trouble connecting to the AI service right now. "
            "For urgent medical concerns, please consult your doctor or call HOSPAIN support."
        )
    }
