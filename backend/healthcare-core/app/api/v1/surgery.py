"""
backend/healthcare-core/app/api/v1/surgery.py

EXECUTION FIX: this file did not exist. app/api/router.py already imported
`from app.api.v1.surgery import router as surgery_router`, which broke the
backend's boot (ModuleNotFoundError) before any request could be served.

SCOPE NOTE: same situation as lab_results.py — no Surgery model exists and
no spec for the workflow (OT scheduling, consent forms, surgeon/anesthetist
assignment, post-op notes). This is a minimal placeholder so the app boots,
not a fabricated feature. Tell me the fields/workflow you need and I'll build
the real version the same way pharmacy.py was built.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("/")
async def list_surgeries():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Surgery scheduling is not built yet. No Surgery model/spec exists in this codebase.",
    )
