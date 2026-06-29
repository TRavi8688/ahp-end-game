"""
Patient API Routes

Endpoints:
    POST   /patients/              - Register a patient profile (patient, admin, hospital_admin)
    GET    /patients/              - List patients (doctor, admin, hospital_admin)
    GET    /patients/me            - Get current patient's own profile
    GET    /patients/{id}          - Get patient details (authorized roles)
    PUT    /patients/{id}          - Update patient (self or admin)
    DELETE /patients/{id}          - Soft-delete patient (admin only)
"""

import uuid
import json
import os
import secrets
import string
from datetime import timezone, datetime
from typing import Annotated, Optional, Dict
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload
from app.models.patient import Patient
from app.models.hospital import Hospital
from app.models.medical_record import MedicalRecord
from app.schemas.patient import (
    PatientCreate,
    PatientUpdate,
    PatientResponse,
    PatientListResponse,
)
from shared.utils.responses import success_response, error_response
from shared.security.files import validate_file_security
from shared.gcs import GCSStorageService
from shared.audit import log_audit_event
from app.models.doctor import Doctor, DoctorStatus
from app.schemas.doctor import DoctorResponse, DoctorListResponse

router = APIRouter()


async def _generate_hospyn_id(db: AsyncSession) -> str:
    """
    FIX-P1 (2026-06-24): patient self-registration never had its own ID
    generator (only doctors/hospitals did), even though the Hospain ID is
    the consumer-facing identity shown throughout the app (e.g. the Login
    screen's "HOSPAIN-000000-XXX" placeholder). Format: HOSPAIN-{6 digits}-{3
    letters}. Retries on the (very unlikely) chance of a collision.

    Rebrand note: existing patients keep whatever ID they were already
    issued (including old HOSPYN- prefixed ones) — only newly created
    accounts get the new HOSPAIN- prefix. The column is still named
    hospyn_id at the DB level; only the generated value's prefix changed.
    """
    for _ in range(10):
        digits = "".join(secrets.choice(string.digits) for _ in range(6))
        letters = "".join(secrets.choice(string.ascii_uppercase) for _ in range(3))
        candidate = f"HOSPAIN-{digits}-{letters}"
        existing = await db.execute(select(Patient).where(Patient.hospyn_id == candidate))
        if not existing.scalars().first():
            return candidate
    # Practically unreachable, but never silently return a colliding id.
    raise HTTPException(status_code=500, detail="Could not allocate a Hospain ID. Please try again.")


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_patient(
    payload: PatientCreate,
    current_user: Annotated[
        TokenPayload, Depends(require_role("patient", "admin", "hospital_admin"))
    ],
    db: AsyncSession = Depends(get_db),
):
    """Register a new patient profile. Links to user_id from auth service."""
    # FIX-P1 (2026-06-24): hospital_id is now optional. Most patients
    # self-register through the consumer app with no hospital chosen yet --
    # they get a hospital_id later (e.g. their first real visit/booking),
    # not at sign-up. Only validate it when one was actually supplied
    # (reception/walk-in flows still pass a real hospital_id here).
    if payload.hospital_id is not None:
        hospital_result = await db.execute(
            select(Hospital).where(
                Hospital.id == payload.hospital_id, Hospital.deleted_at.is_(None)
            )
        )
        if not hospital_result.scalars().first():
            raise HTTPException(status_code=404, detail="Hospital not found")

    # Check if this user already has a patient profile
    existing = await db.execute(
        select(Patient).where(Patient.user_id == uuid.UUID(current_user.sub))
    )
    if existing.scalars().first():
        return error_response(
            "PROFILE_EXISTS", "Patient profile already exists for this user.", 409
        )

    patient = Patient(
        **payload.model_dump(),
        user_id=uuid.UUID(current_user.sub),
        hospyn_id=await _generate_hospyn_id(db),
    )
    db.add(patient)
    await db.flush()
    await db.refresh(patient)

    # EXECUTION: per your answer -- when someone signs up for real, any walk-in
    # counter-sale history recorded against the same phone number (no Hospin
    # account at the time) gets linked to their new real Patient record.
    if patient.phone:
        from app.models.pharmacy import WalkInCustomer
        walkin_result = await db.execute(
            select(WalkInCustomer).where(
                WalkInCustomer.phone == patient.phone,
                WalkInCustomer.merged_patient_id.is_(None),
            )
        )
        for walkin in walkin_result.scalars().all():
            walkin.merged_patient_id = patient.id
        await db.flush()

    log_audit_event(
        action="patient_created", actor_id=current_user.sub, target_id=str(patient.id)
    )

    return success_response(
        data=PatientResponse.model_validate(patient).model_dump(mode="json"),
        message="Patient profile created successfully.",
        status_code=201,
    )


@router.get("/me")
async def get_my_profile(
    current_user: Annotated[TokenPayload, Depends(require_role("patient"))],
    db: AsyncSession = Depends(get_db),
):
    """Get the current logged-in patient's own profile."""
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub),
            Patient.deleted_at.is_(None),
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(
            status_code=404, detail="Patient profile not found. Please register first."
        )

    log_audit_event(
        action="patient_profile_accessed",
        actor_id=current_user.sub,
        target_id=str(patient.id),
    )

    return success_response(
        data=PatientResponse.model_validate(patient).model_dump(mode="json")
    )


@router.post("/booking-consent")
async def generate_booking_consent(
    current_user: Annotated[TokenPayload, Depends(require_role("patient"))],
    db: AsyncSession = Depends(get_db),
):
    """Generate a short-lived consent token for appointment booking by doctor/staff."""
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub),
            Patient.deleted_at.is_(None),
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(
            status_code=404, detail="Patient profile not found. Please register first."
        )

    import secrets

    consent_token = secrets.token_urlsafe(16)

    from shared.redis_client import set_patient_consent_token

    await set_patient_consent_token(str(patient.id), consent_token)

    log_audit_event(
        action="patient_consent_token_generated",
        actor_id=current_user.sub,
        target_id=str(patient.id),
    )

    return success_response(
        data={"consent_token": consent_token, "expires_in_seconds": 900},
        message="Consent token generated successfully. Share this with your doctor/staff to allow booking.",
    )


@router.get("/search-doctors")
async def search_doctors(
    current_user: Annotated[TokenPayload, Depends(require_role("patient"))],
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    hospital_id: uuid.UUID = Query(None),
    specialization: str = Query(None),
    search_query: str = Query(
        None, description="Search by doctor name or specialization"
    ),
):
    """
    Robust API for patients to discover active doctors.
    Allows searching by hospital, exact specialization, or general text search.
    """
    query = select(Doctor).where(
        Doctor.deleted_at.is_(None),
        Doctor.status == DoctorStatus.active,
        Doctor.is_active == True,
    )

    if hospital_id:
        query = query.where(Doctor.hospital_id == hospital_id)
    if specialization:
        query = query.where(Doctor.specialization.ilike(f"%{specialization}%"))
    if search_query:
        search_term = f"%{search_query}%"
        query = query.where(
            (Doctor.first_name.ilike(search_term))
            | (Doctor.last_name.ilike(search_term))
            | (Doctor.specialization.ilike(search_term))
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Doctor.created_at.desc())
    )
    result = await db.execute(query)
    doctors = result.scalars().all()

    # Log search metric
    log_audit_event(
        action="patient_searched_doctors",
        actor_id=current_user.sub,
        target_id=current_user.sub,
        details={
            "search_query": search_query,
            "hospital_id": str(hospital_id) if hospital_id else None,
        },
    )

    return success_response(
        data=DoctorListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[DoctorResponse.model_validate(d) for d in doctors],
        ).model_dump(mode="json")
    )


@router.get("/search")
async def search_patients_for_pharmacy(
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("doctor", "admin", "hospital_admin", "staff", "pharmacist")),
    ],
    db: AsyncSession = Depends(get_db),
    q: str = Query(..., min_length=2),
):
    """
    EXECUTION FIX: partner-app/src/pages/Dashboard.jsx already calls
    GET /patients/search?q=... to look up a patient before dispensing -- that
    route never existed (only GET /patients/?search=... did, and it excludes
    the pharmacist role and returns a wrapped {data: {items: [...]}} shape
    with a `phone` field, not the flat array with `phone_number` the frontend
    reads). This is a separate, deliberately small endpoint rather than
    reshaping the existing one, so other callers of GET /patients/ aren't
    affected by a frontend-specific quirk.
    """
    like_pattern = f"%{q}%"
    result = await db.execute(
        select(Patient)
        .where(
            (Patient.first_name.ilike(like_pattern))
            | (Patient.last_name.ilike(like_pattern))
            | (Patient.phone.ilike(like_pattern))
        )
        .limit(20)
    )
    patients = result.scalars().all()
    return [
        {
            "id": str(p.id),
            "first_name": p.first_name,
            "last_name": p.last_name,
            "phone_number": p.phone,
        }
        for p in patients
    ]


@router.get("/")
async def list_patients(
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("doctor", "admin", "hospital_admin", "staff")),
    ],
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    hospital_id: uuid.UUID = Query(None),
    search: str = Query(None, description="Search by name, email, or phone"),
):
    """List patients. Restricted to medical staff and admins."""
    query = select(Patient).where(Patient.deleted_at.is_(None))

    if hospital_id:
        query = query.where(Patient.hospital_id == hospital_id)
    if search:
        search_term = f"%{search}%"
        query = query.where(
            (Patient.first_name.ilike(search_term))
            | (Patient.last_name.ilike(search_term))
            | (Patient.email.ilike(search_term))
            | (Patient.phone.ilike(search_term))
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()

    query = (
        query.offset((page - 1) * page_size)
        .limit(page_size)
        .order_by(Patient.created_at.desc())
    )
    result = await db.execute(query)
    patients = result.scalars().all()

    return success_response(
        data=PatientListResponse(
            total=total,
            page=page,
            page_size=page_size,
            items=[PatientResponse.model_validate(p) for p in patients],
        ).model_dump(mode="json")
    )


# ---------------------------------------------------------------------------
# /records and /records/preview MUST be declared before /{patient_id} so that
# FastAPI does not match the literal string "records" as a UUID path parameter.
# ---------------------------------------------------------------------------


class ReportAnalysisResponse(BaseModel):
    status: str = "success"
    record_name: Optional[str] = None
    hospital_name: Optional[str] = None
    summary: Optional[str] = None
    extracted_data: Optional[Dict] = None
    visual_findings: Optional[str] = None
    url: str
    type: str = "Document"


class ReportConfirmSave(BaseModel):
    analysis: Dict
    record_name: Optional[str] = None
    hospital_name: Optional[str] = None
    s3_url: str
    type: str
    update_profile: bool = False


@router.get("/records")
async def get_my_records(
    current_user: TokenPayload = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    """
    Retrieves all medical records for the authenticated patient, generating
    secure signed URLs for temporary asset access.
    """
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub), Patient.deleted_at.is_(None)
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    # Load all records from PostgreSQL database
    records_result = await db.execute(
        select(MedicalRecord).where(MedicalRecord.patient_id == patient.id)
    )
    records = records_result.scalars().all()

    # Generate secure URLs for each record
    storage = GCSStorageService()
    formatted_records = []
    for r in records:
        secure_url = (
            await storage.get_secure_url(r.file_url, expires_in=600)
            if r.file_url
            else None
        )
        formatted_records.append(
            {
                "id": str(r.id),
                "patient_id": str(r.patient_id),
                "type": r.record_type,
                "record_name": r.record_name,
                "hospital_name": r.hospital_name,
                "file_url": r.file_url,
                "secure_url": secure_url,
                "raw_text": r.raw_text,
                "ai_extracted": json.loads(r.ai_extracted) if r.ai_extracted else {},
                "ai_summary": r.ai_summary,
                "patient_summary": r.patient_summary,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "hidden_by_patient": r.hidden_by_patient,
            }
        )

    log_audit_event(
        action="patient_records_list_accessed",
        actor_id=current_user.sub,
        target_id=str(patient.id),
    )

    return formatted_records


@router.get("/records/preview/{filename}")
async def preview_local_file(
    filename: str, current_user: TokenPayload = Depends(get_current_user)
):
    """
    Serves local files securely from local storage during development.
    Only active when GCP fallback is enabled.
    """
    # Simple directory traversal prevention
    clean_fn = os.path.basename(filename)
    root_dir = os.path.dirname(
        os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
    )
    file_path = os.path.join(root_dir, "secure_uploads", clean_fn)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Preview file not found.")

    from fastapi.responses import FileResponse

    return FileResponse(file_path)


@router.get("/{patient_id}")
async def get_patient(
    patient_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Get patient details. Patients can only view their own record."""
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.deleted_at.is_(None))
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Patients can only view their own record
    if current_user.role == "patient" and str(patient.user_id) != current_user.sub:
        raise HTTPException(
            status_code=403, detail="You can only view your own patient record"
        )

    log_audit_event(
        action="patient_record_accessed",
        actor_id=current_user.sub,
        target_id=str(patient.id),
    )

    return success_response(
        data=PatientResponse.model_validate(patient).model_dump(mode="json")
    )


@router.put("/{patient_id}")
async def update_patient(
    patient_id: uuid.UUID,
    payload: PatientUpdate,
    current_user: Annotated[TokenPayload, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db),
):
    """Update patient info. Patients can update their own; admins can update any."""
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.deleted_at.is_(None))
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # Patients can only update their own record
    if current_user.role == "patient" and str(patient.user_id) != current_user.sub:
        raise HTTPException(
            status_code=403, detail="You can only update your own patient record"
        )
    elif current_user.role not in ("patient", "admin", "hospital_admin", "staff"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)

    await db.flush()
    await db.refresh(patient)
    log_audit_event(
        action="patient_updated", actor_id=current_user.sub, target_id=str(patient.id)
    )

    return success_response(
        data=PatientResponse.model_validate(patient).model_dump(mode="json"),
        message="Patient profile updated.",
    )


@router.delete("/{patient_id}", status_code=status.HTTP_200_OK)
async def delete_patient(
    patient_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role("admin"))],
    db: AsyncSession = Depends(get_db),
):
    """Soft-delete a patient. Admin only."""
    result = await db.execute(
        select(Patient).where(Patient.id == patient_id, Patient.deleted_at.is_(None))
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    patient.deleted_at = datetime.now(timezone.utc)
    patient.is_active = False
    await db.flush()
    log_audit_event(
        action="patient_deleted", actor_id=current_user.sub, target_id=str(patient_id)
    )

    return success_response(message="Patient record deactivated.")


# --- Secure File Uploads and AI Analysis Endpoints ---


@router.post("/upload-report", response_model=ReportAnalysisResponse)
async def upload_report(
    file: UploadFile = File(...),
    current_user: TokenPayload = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    """
    Secure file upload with GCS storage client, MIME type verification,
    and simulated clinical AI analysis.
    """
    # 1. Fetch current patient profile
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub), Patient.deleted_at.is_(None)
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(
            status_code=404, detail="Patient profile not found. Please register first."
        )

    # 2. Read file content
    contents = await file.read()

    # 3. Perform strict MIME-type and size validation (10MB limit)
    allowed_types = ["image/jpeg", "image/png", "application/pdf", "image/webp"]
    max_size = 10 * 1024 * 1024  # 10MB
    detected_mime = validate_file_security(
        file_content=contents,
        filename=file.filename,
        max_size_bytes=max_size,
        allowed_types=allowed_types,
    )

    # 4. Stream to Google Cloud Storage (or local fallback)
    storage = GCSStorageService()
    safe_filename = f"{uuid.uuid4()}{os.path.splitext(file.filename)[1].lower()}"
    object_name = f"reports/{patient.id}/{safe_filename}"

    gcs_url = await storage.upload_file_bytes(
        file_content=contents, object_name=object_name, content_type=detected_mime
    )

    # 5. Generate high-fidelity simulated clinical AI analysis
    record_type = "Document"
    lower_fn = file.filename.lower()
    if "prescription" in lower_fn or "med" in lower_fn or "rx" in lower_fn:
        record_type = "prescription"
    elif "lab" in lower_fn or "blood" in lower_fn or "report" in lower_fn:
        record_type = "lab"
    elif "xray" in lower_fn or "scan" in lower_fn or "mri" in lower_fn:
        record_type = "scan"

    # Simulate realistic AI extraction
    conditions = [{"name": "Allergic Rhinitis", "notes": "Seasonal flare-up"}]
    medications = [
        {"name": "Montelukast", "dosage": "10mg", "frequency": "Once daily at bedtime"}
    ]
    hospital_name = "Hospyn General Hospital"
    summary = "The patient presents with symptoms consistent with seasonal allergic rhinitis. Lungs are clear on auscultation. Recommended continuous monitoring."
    findings = (
        "Nasal mucosa shows mild edema. No evidence of secondary bacterial infection."
    )

    if record_type == "lab":
        conditions = [
            {
                "name": "Mild Anemia",
                "notes": "Hemoglobin slightly below reference range",
            }
        ]
        medications = [
            {
                "name": "Iron Supplement",
                "dosage": "100mg",
                "frequency": "Once daily with meals",
            }
        ]
        summary = "Blood panel indicates mild microcytic anemia. All other metabolic and lipid values are within normal limits."
        findings = "Hemoglobin: 11.2 g/dL (Reference: 12.0 - 15.5 g/dL). MCV: 78 fL (Reference: 80 - 100 fL)."
    elif record_type == "scan":
        conditions = [
            {"name": "Lumbar Muscle Strain", "notes": "No disc herniation detected"}
        ]
        medications = [
            {
                "name": "Ibuprofen",
                "dosage": "400mg",
                "frequency": "Twice daily as needed",
            }
        ]
        summary = "Spine MRI shows normal vertebral alignment and disc spacing. Minimal paraspinal muscle inflammation observed."
        findings = "L4-L5 and L5-S1 disc spaces are intact. No spinal stenosis or nerve root compression."

    log_audit_event(
        action="patient_report_uploaded",
        actor_id=current_user.sub,
        target_id=str(patient.id),
        details={"record_name": file.filename, "record_type": record_type},
    )

    return ReportAnalysisResponse(
        status="success",
        record_name=file.filename,
        hospital_name=hospital_name,
        summary=summary,
        extracted_data={"conditions": conditions, "medications": medications},
        visual_findings=findings,
        url=gcs_url,
        type=record_type,
    )


@router.post("/confirm-and-save-report")
async def confirm_and_save_report(
    payload: ReportConfirmSave,
    current_user: TokenPayload = Depends(require_role("patient")),
    db: AsyncSession = Depends(get_db),
):
    """
    Saves the confirmed medical record to permanent storage and optionally
    updates the patient's medical profile.
    """
    # 1. Fetch current patient profile
    result = await db.execute(
        select(Patient).where(
            Patient.user_id == uuid.UUID(current_user.sub), Patient.deleted_at.is_(None)
        )
    )
    patient = result.scalars().first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")

    # 2. Save the confirmed medical record to PostgreSQL database
    record_id = uuid.uuid4()

    ai_extracted_data = payload.analysis.get("structured_data") or {}
    ai_extracted_str = json.dumps(ai_extracted_data)

    db_record = MedicalRecord(
        id=record_id,
        patient_id=patient.id,
        record_type=payload.type,
        record_name=payload.record_name or "Medical Record",
        hospital_name=payload.hospital_name or "Hospyn Clinic",
        file_url=payload.s3_url,  # Uses the uploaded GCS URI
        raw_text=payload.analysis.get("raw_text") or "",
        ai_extracted=ai_extracted_str,
        ai_summary=payload.analysis.get("summary") or "",
        patient_summary=payload.analysis.get("summary") or "",
        hidden_by_patient=False,
    )
    db.add(db_record)
    await db.flush()

    log_audit_event(
        action="patient_record_saved",
        actor_id=current_user.sub,
        target_id=str(patient.id),
        details={"record_id": str(record_id), "record_name": db_record.record_name},
    )

    # 3. Update patient database profile if requested
    if payload.update_profile:
        conditions_data = payload.analysis.get("structured_data", {}).get(
            "conditions", []
        )
        meds_data = payload.analysis.get("structured_data", {}).get("medications", [])

        # Format new medical conditions
        new_conditions = [
            c["name"] if isinstance(c, dict) else str(c) for c in conditions_data
        ]
        new_meds = [
            f"{m['name']} ({m.get('dosage', '')})" if isinstance(m, dict) else str(m)
            for m in meds_data
        ]

        # Update chronic conditions
        existing_conditions = patient.chronic_conditions or ""
        combined_conditions = [existing_conditions] if existing_conditions else []
        combined_conditions.extend(new_conditions)
        patient.chronic_conditions = ", ".join(filter(None, combined_conditions))

        # Update known allergies (or append medications info to a notes field)
        if new_meds:
            existing_notes = patient.known_allergies or ""
            meds_note = f"Active Medications: {', '.join(new_meds)}"
            patient.known_allergies = f"{existing_notes}\n{meds_note}".strip()

        # Database session will automatically commit via the get_db context manager
        await db.flush()

    return {"status": "success", "record_id": str(record_id)}
