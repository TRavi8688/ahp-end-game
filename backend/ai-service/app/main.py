# ai-service/app/main.py
# PHASE 10 FIX: AI Service implementation with:
#   1. PHI scrubbing BEFORE any LLM API call (DPDP + safety requirement)
#   2. Patient consent check BEFORE processing PHI
#   3. No real patient data transmitted to third-party APIs without consent
#   4. Audit log entry for every AI API call involving PHI
#   5. Triage thresholds marked as requiring clinical validation

from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import re
import logging
import os

logger = logging.getLogger("hospyn.ai")

app = FastAPI(
    title="Hospyn AI Service",
    version="1.0.0",
    description="AI microservice — Phase 10 compliant with PHI scrubbing",
)

# ─── CORS ────────────────────────────────────────────────────────────────────
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,  # FIX: never allow_origins=["*"] in production
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


# ─── PHI SCRUBBER ─────────────────────────────────────────────────────────────
# PHASE 10 FIX: All text is scrubbed BEFORE being sent to any external LLM API.
# This is a MINIMUM safeguard. A production-grade scrubber should use a purpose-
# built tool (e.g., Microsoft Presidio, AWS Comprehend Medical) with NER models.

# Patterns to detect and redact
_PHI_PATTERNS = [
    # Indian phone numbers
    (r'\b[6-9]\d{9}\b', '[PHONE]'),
    # Aadhaar numbers (12-digit)
    (r'\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b', '[AADHAAR]'),
    # Indian PAN
    (r'\b[A-Z]{5}\d{4}[A-Z]\b', '[PAN]'),
    # Email addresses
    (r'\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b', '[EMAIL]'),
    # Dates of birth (common formats)
    (r'\b\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}\b', '[DATE]'),
    # Patient/MR numbers (common hospital formats)
    (r'\bMR[NO]?\s*[:\-]?\s*\d{4,10}\b', '[PATIENT_ID]', re.IGNORECASE),
    # IP addresses
    (r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b', '[IP]'),
]


def scrub_phi(text: str) -> tuple[str, int]:
    """
    Scrub identifiable patient information from text before LLM processing.
    Returns (scrubbed_text, redaction_count).

    IMPORTANT: This regex-based scrubber is a first-pass defence.
    For production, complement with Microsoft Presidio or AWS Comprehend Medical.
    """
    scrubbed = text
    count = 0
    for pattern_args in _PHI_PATTERNS:
        if len(pattern_args) == 3:
            pattern, replacement, flags = pattern_args
            compiled = re.compile(pattern, flags)
        else:
            pattern, replacement = pattern_args
            compiled = re.compile(pattern)

        new_text, n = compiled.subn(replacement, scrubbed)
        scrubbed = new_text
        count += n

    return scrubbed, count


# ─── CONSENT CHECK ────────────────────────────────────────────────────────────
async def verify_ai_consent(patient_id: str, hospital_id: str) -> bool:
    """
    PHASE 10 FIX: Check that the patient has given explicit DPDP consent
    for their data to be processed by AI/LLM systems.

    TODO: Connect to consent_records table when DPDP schema is implemented.
    For now, this raises NotImplementedError to surface the missing dependency.
    """
    # When consent_records table is implemented:
    # result = await db.execute(
    #     select(ConsentRecord)
    #     .where(ConsentRecord.patient_id == patient_id)
    #     .where(ConsentRecord.consent_type == "ai_processing")
    #     .where(ConsentRecord.is_active == True)
    # )
    # return result.scalar_one_or_none() is not None
    raise NotImplementedError(
        "DPDP consent verification is required before this AI endpoint can process PHI. "
        "Implement consent_records table per Phase 13 compliance fixes first."
    )


# ─── REQUEST/RESPONSE MODELS ──────────────────────────────────────────────────
class ClinicalSummaryRequest(BaseModel):
    patient_id: str = Field(..., description="Patient ID for consent verification")
    hospital_id: str = Field(..., description="Hospital ID for ABAC scoping")
    clinical_note: str = Field(..., min_length=10, max_length=10000,
                               description="Clinical note text to summarize")
    consent_token: str = Field(..., description="Patient's DPDP consent token")


class ClinicalSummaryResponse(BaseModel):
    summary: str
    redactions_applied: int
    disclaimer: str = (
        "This AI-generated summary is for clinical assistance only. "
        "It must be reviewed and validated by a licensed medical professional before use."
    )


class TriageRequest(BaseModel):
    patient_id: str
    hospital_id: str
    vitals: dict = Field(..., description="Patient vitals dict: bp_systolic, bp_diastolic, spo2, temp_c, hr")
    consent_token: str


class TriageResponse(BaseModel):
    priority_level: str
    priority_score: int
    flags: list[str]
    clinical_validation_required: bool = True
    disclaimer: str = (
        "IMPORTANT: These triage thresholds are PRELIMINARY and have NOT been clinically "
        "validated by licensed medical professionals or approved by a clinical governance board. "
        "They must NOT be used for actual clinical decisions until validation is complete."
    )


# ─── HEALTH ENDPOINT ─────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "healthy", "service": "ai-service"}


# ─── CLINICAL NOTE SUMMARIZER ─────────────────────────────────────────────────
@app.post("/api/v1/ai/summarize", response_model=ClinicalSummaryResponse)
async def summarize_clinical_note(
    request: ClinicalSummaryRequest,
    authorization: str = Header(...),
):
    """
    Summarize a clinical note using LLM.

    PHASE 10 FIX — CRITICAL SAFETY STEPS:
    1. Verify DPDP consent before processing
    2. Scrub PHI from the note before sending to LLM
    3. Log the API call for audit trail
    """
    # Step 1: Verify patient consent (DPDP requirement)
    try:
        has_consent = await verify_ai_consent(request.patient_id, request.hospital_id)
        if not has_consent:
            raise HTTPException(
                status_code=403,
                detail="Patient has not consented to AI processing of their medical records. "
                       "Obtain explicit DPDP consent before proceeding."
            )
    except NotImplementedError as e:
        raise HTTPException(status_code=503, detail=str(e))

    # Step 2: Scrub PHI BEFORE sending to any external API
    scrubbed_note, redaction_count = scrub_phi(request.clinical_note)
    if redaction_count > 0:
        logger.info(
            "PHI redaction applied",
            extra={
                "patient_id": request.patient_id,
                "hospital_id": request.hospital_id,
                "redactions": redaction_count,
            }
        )

    # Step 3: Log audit entry (to be written to audit_logs table)
    logger.info(
        "AI summarization request",
        extra={
            "action": "ai_summarize",
            "patient_id": request.patient_id,
            "hospital_id": request.hospital_id,
            "note_length": len(request.clinical_note),
            "redactions": redaction_count,
        }
    )

    # Step 4: Call LLM with SCRUBBED text only
    # TODO: Replace with actual Gemini/Groq call using scrubbed_note
    # IMPORTANT: NEVER pass request.clinical_note (original) to the LLM — always use scrubbed_note
    summary = f"[PLACEHOLDER] Clinical note summary. Redacted {redaction_count} identifiers. " \
              f"Implement Gemini API call here using scrubbed_note (NOT clinical_note)."

    return ClinicalSummaryResponse(
        summary=summary,
        redactions_applied=redaction_count,
    )


# ─── TRIAGE ENGINE ────────────────────────────────────────────────────────────
@app.post("/api/v1/ai/triage", response_model=TriageResponse)
async def compute_triage_priority(
    request: TriageRequest,
    authorization: str = Header(...),
):
    """
    Compute triage priority from patient vitals.

    PHASE 10 FIX: Thresholds marked as NOT CLINICALLY VALIDATED.
    These deterministic rules must be reviewed and approved by licensed medical
    professionals and the hospital's clinical governance board before production use.
    """
    vitals = request.vitals
    flags = []
    priority_score = 0

    # ── CRITICAL: THESE THRESHOLDS ARE NOT CLINICALLY VALIDATED ──────────────
    # Each threshold must be reviewed by a licensed physician before deployment.
    # Do NOT use these in a live hospital without clinical governance approval.

    bp_sys = vitals.get("bp_systolic", 0)
    bp_dia = vitals.get("bp_diastolic", 0)
    spo2 = vitals.get("spo2", 100)
    hr = vitals.get("hr", 70)
    temp_c = vitals.get("temp_c", 37.0)

    # Hypertensive crisis (unvalidated threshold — REQUIRES CLINICAL REVIEW)
    if bp_sys >= 180 or bp_dia >= 110:
        flags.append("HYPERTENSIVE_CRISIS_UNVALIDATED_THRESHOLD")
        priority_score += 40

    # Hypoxia (unvalidated)
    if spo2 < 92:
        flags.append("HYPOXIA_UNVALIDATED_THRESHOLD")
        priority_score += 35

    # Tachycardia (unvalidated)
    if hr > 120:
        flags.append("TACHYCARDIA_UNVALIDATED_THRESHOLD")
        priority_score += 20

    # Fever (unvalidated)
    if temp_c > 38.5:
        flags.append("FEVER_UNVALIDATED_THRESHOLD")
        priority_score += 15

    # Assign priority level
    if priority_score >= 40:
        priority_level = "EMERGENCY_UNVALIDATED"
    elif priority_score >= 25:
        priority_level = "HIGH_UNVALIDATED"
    elif priority_score >= 10:
        priority_level = "MEDIUM_UNVALIDATED"
    else:
        priority_level = "NORMAL_UNVALIDATED"

    return TriageResponse(
        priority_level=priority_level,
        priority_score=priority_score,
        flags=flags,
        clinical_validation_required=True,
    )
