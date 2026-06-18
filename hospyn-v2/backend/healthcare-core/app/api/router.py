"""
backend/healthcare-core/app/api/router.py  (final version)

All routes registered. Prefix is /api/v1 — NOT /api/v1/healthcare.
"""

from fastapi import APIRouter

from app.api.v1.auth            import router as auth_router
from app.api.v1.hospitals       import router as hospitals_router
from app.api.v1.doctors         import router as doctors_router
from app.api.v1.patients        import router as patients_router
from app.api.v1.appointments    import router as appointments_router
from app.api.v1.clinical        import router as clinical_router
from app.api.v1.walkin          import router as walkin_router
from app.api.v1.reception       import router as reception_router
from app.api.v1.nurse           import router as nurse_router
from app.api.v1.doctor_queue    import router as doctor_queue_router
from app.api.v1.ws_endpoint     import router as ws_router
from app.api.v1.medicines       import router as medicines_router
from app.api.v1.billing         import router as billing_router
from app.api.v1.owner           import router as owner_router
from app.api.v1.doctor_stats_alerts          import router as doctor_extras_router
from app.api.v1.patient_vitals_notifications import router as patient_extras_router
from app.api.v1.staff           import router as staff_router
from app.api.v1.prescriptions   import router as prescriptions_router
from app.api.v1.lab_results     import router as lab_results_router
from app.api.v1.consent         import router as consent_router
from app.api.v1.surgery         import router as surgery_router
from app.api.v1.doctor_extensions  import router as doctor_ext_router
from app.api.v1.patient_extensions import router as patient_ext_router
from app.api.v1.pharmacy        import router as pharmacy_router
from app.api.v1.onboarding      import router as onboarding_router, walkin_public_router
from app.api.v1.onboarding_admin import router as onboarding_admin_router
from app.api.v1.tickets         import router as tickets_router
from app.api.v1.employees       import router as employees_router

api_router = APIRouter()

# ── Public: Onboarding ────────────────────────────────────────────────────────
api_router.include_router(onboarding_router,       prefix="/onboarding", tags=["Onboarding"])
api_router.include_router(onboarding_admin_router, prefix="/onboarding", tags=["Onboarding Admin"])
api_router.include_router(walkin_public_router,    prefix="/walkin",     tags=["Walk-In Public"])

# ── Ticket System ─────────────────────────────────────────────────────────────
api_router.include_router(tickets_router,   prefix="/tickets",   tags=["Support Tickets"])

# ── Hospyn Internal Employees ─────────────────────────────────────────────────
api_router.include_router(employees_router, prefix="/employees", tags=["Hospyn Employees"])

# ── Core Clinical ─────────────────────────────────────────────────────────────
api_router.include_router(auth_router,          prefix="/auth",         tags=["Auth"])
api_router.include_router(hospitals_router,     prefix="/hospitals",    tags=["Hospitals"])
api_router.include_router(doctors_router,       prefix="/doctors",      tags=["Doctors"])
api_router.include_router(patients_router,      prefix="/patients",     tags=["Patients"])
api_router.include_router(appointments_router,  prefix="/appointments", tags=["Appointments"])
api_router.include_router(clinical_router,      prefix="/clinical",     tags=["Clinical"])
api_router.include_router(walkin_router,        prefix="/walkin",       tags=["Walk-In"])
api_router.include_router(reception_router,     prefix="/reception",    tags=["Reception"])
api_router.include_router(nurse_router,         prefix="/nurse",        tags=["Nurse"])
api_router.include_router(doctor_queue_router,  prefix="/doctor",       tags=["Doctor Queue"])
api_router.include_router(medicines_router,     prefix="/medicines",    tags=["Medicines"])
api_router.include_router(prescriptions_router, prefix="/prescriptions",tags=["Prescriptions"])
api_router.include_router(lab_results_router,   prefix="/lab_results",  tags=["Lab Results"])
api_router.include_router(surgery_router,       prefix="/surgery",      tags=["Surgery"])

# ── WebSockets ────────────────────────────────────────────────────────────────
api_router.include_router(ws_router)

# ── Owner Dashboard + HR ──────────────────────────────────────────────────────
api_router.include_router(owner_router,          prefix="/owner",   tags=["Owner Dashboard"])
api_router.include_router(doctor_extras_router,  prefix="/doctor",  tags=["Doctor Stats"])
api_router.include_router(patient_extras_router, prefix="/patient", tags=["Patient Extras"])
api_router.include_router(billing_router,        prefix="/billing", tags=["Billing"])
api_router.include_router(staff_router,          prefix="/staff",   tags=["Staff HR"])

# ── DPDP Compliance ───────────────────────────────────────────────────────────
api_router.include_router(consent_router,        prefix="/consent", tags=["DPDP Compliance"])

# ── Extensions ────────────────────────────────────────────────────────────────
api_router.include_router(doctor_ext_router,     prefix="/doctor",   tags=["Doctor Ext"])
api_router.include_router(patient_ext_router,    prefix="/patients", tags=["Patient Ext"])
api_router.include_router(pharmacy_router,       prefix="/pharmacy", tags=["Pharmacy"])
