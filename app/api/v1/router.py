from fastapi import APIRouter
from app.api.v1.endpoints import (
    admin, hospital, queue, admission, clinical, pharmacy, analytics, timeline, referrals, billing, lab, patient, patient_app
)

api_router = APIRouter()

# API V1 Routes
api_router.include_router(admin.router, prefix="/admin", tags=["Super Admin Operations"])
api_router.include_router(hospital.router, prefix="/hospital", tags=["Hospital Operations"])
api_router.include_router(queue.router, prefix="/queue", tags=["Queue Engine"])
api_router.include_router(patient.router, prefix="/patients", tags=["Patient Intake"])
api_router.include_router(admission.router, prefix="/admissions", tags=["Admissions Workflow"])
api_router.include_router(clinical.router, prefix="/clinical", tags=["Clinical Operations"])
api_router.include_router(timeline.router, prefix="/clinical", tags=["Clinical Journey"])
api_router.include_router(pharmacy.router, prefix="/pharmacy", tags=["Pharmacy Inventory"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["Clinical Intelligence"])
api_router.include_router(referrals.router, prefix="/referrals", tags=["Partner Referral Network"])
api_router.include_router(billing.router, prefix="/billing", tags=["Financial Billing & POS"])
api_router.include_router(lab.router, prefix="/lab", tags=["Laboratory & Diagnostics"])
api_router.include_router(patient_app.router, prefix="/patient-app", tags=["Patient App Workflows"])
