"""
backend/healthcare-core/app/api/v1/lab_results.py

EXECUTION FIX: this file did not exist. app/api/router.py already imported
`from app.api.v1.lab_results import router as lab_results_router`, which broke
the backend's boot (ModuleNotFoundError) before any request could be served.

SCOPE NOTE: this is intentionally a minimal, honest placeholder, not a full
lab-results feature. There is no LabResult model anywhere in this codebase
and no spec for what fields/workflow it needs (which lab partners, report
formats, who can release results to a patient, etc.) — building that out
would mean guessing at a clinical data model, which isn't something to
fabricate. This file exists so the app boots; the single endpoint below
returns 501 rather than silently pretending to be a working feature.

When you're ready to build this for real, tell me the fields you need
(test name, reference ranges, report file upload, who can view/release
results) and I'll build the model + migration + full router the same way
pharmacy.py was built.
"""

from fastapi import APIRouter, HTTPException, status

router = APIRouter()


@router.get("/")
async def list_lab_results():
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Lab results is not built yet. No LabResult model/spec exists in this codebase.",
    )
