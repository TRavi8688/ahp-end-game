"""
backend/healthcare-core/app/api/v1/consent.py

EXECUTION FIX: this file did not exist. app/api/router.py already imported
`from app.api.v1.consent import router as consent_router`, which broke the
backend's boot (ModuleNotFoundError) before any request could be served.

SCOPE NOTE: this is intentionally a minimal placeholder, not a full DPDP
consent feature, and for a different reason than lab_results.py/surgery.py:
a Consent model already exists, but in TWO other places —
  - backend/ai-service/app/models/consent.py
  - backend/app/models/consent.py
— neither of which is healthcare-core's own database. Building a third,
disconnected Consent model here would create exactly the kind of fragmented,
inconsistent state this codebase already has too much of (see pharmacy.py's
removal notes). Before building this for real, those two existing consent
models need to be reconciled into one source of truth — tell me which one
should win (or if it should be a shared service) and I'll wire it properly.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("/")
async def list_consent_records():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=(
            "Consent records are not wired up in healthcare-core yet — two other "
            "Consent models already exist elsewhere in this codebase and need to "
            "be reconciled first (see this file's module docstring)."
        ),
    )
