"""
backend/healthcare-core/app/api/router.py

WHAT CHANGED vs existing file:
  - Added super_admin router at /admin (was completely missing — 16 endpoints 404'd)
  - Added tickets router at /tickets
  - Added partner routers (auth, dashboard, inventory, orders, referrals, lab, support)
  - Added consent router for DPDP compliance
  - Added prescriptions, lab_results, surgery, pharmacy routers
  - Added doctor_extensions, patient_extensions
"""

from fastapi import APIRouter

# ── Core clinical ─────────────────────────────────────────────────────────────
from app.api.v1.hospitals     import router as hospitals_router
from app.api.v1.doctors       import router as doctors_router
from app.api.v1.patients      import router as patients_router
from app.api.v1.appointments  import router as appointments_router
from app.api.v1.clinical      import router as clinical_router
from app.api.v1.walkin        import router as walkin_router
from app.api.v1.reception     import router as reception_router
from app.api.v1.nurse         import router as nurse_router
from app.api.v1.doctor_queue  import router as doctor_queue_router
from app.api.v1.ws_endpoint   import router as ws_router
from app.api.v1.medicines     import router as medicines_router
from app.api.v1.billing       import router as billing_router
from app.api.v1.owner         import router as owner_router
from app.api.v1.doctor_stats_alerts         import router as doctor_extras_router
from app.api.v1.patient_vitals_notifications import router as patient_extras_router
from app.api.v1.staff         import router as staff_router

# ── Super Admin (FIXED: was missing — all /admin/* endpoints returned 404) ────
from app.api.v1.super_admin   import router as super_admin_router

# ── Support Ticket System ─────────────────────────────────────────────────────
from app.api.v1.tickets       import router as tickets_router

# ── Partner (pharma/lab) ──────────────────────────────────────────────────────
from app.api.v1.partner_auth       import router as partner_auth_router
from app.api.v1.partner_dashboard  import router as partner_dashboard_router
from app.api.v1.partner_inventory  import router as partner_inventory_router
from app.api.v1.partner_orders     import router as partner_orders_router
from app.api.v1.partner_referrals  import router as partner_referrals_router
from app.api.v1.partner_lab        import router as partner_lab_router
from app.api.v1.partner_support    import router as partner_support_router
from app.api.v1.partner_queue      import router as partner_queue_router

# ── Extended clinical ─────────────────────────────────────────────────────────
from app.api.v1.prescriptions         import router as prescriptions_router
from app.api.v1.lab_results           import router as lab_results_router
from app.api.v1.surgery               import router as surgery_router
from app.api.v1.pharmacy              import router as pharmacy_router
from app.api.v1.consent               import router as consent_router
from app.api.v1.doctor_extensions     import router as doctor_ext_router
from app.api.v1.patient_extensions    import router as patient_ext_router

router = APIRouter()

# ── Super Admin — mounted at /admin ──────────────────────────────────────────
# FIXED: This entire block was missing. The super-admin dashboard calls
# /api/v1/admin/analytics/overview, /api/v1/admin/hospitals, etc.
# Without this, every super-admin request returned 404.
router.include_router(super_admin_router, prefix="/admin",  tags=["Super Admin"])

# ── Support Tickets ───────────────────────────────────────────────────────────
router.include_router(tickets_router,    prefix="/tickets", tags=["Support Tickets"])

# ── Core clinical routes ──────────────────────────────────────────────────────
router.include_router(hospitals_router,    prefix="/hospitals",    tags=["Hospitals"])
router.include_router(doctors_router,      prefix="/doctors",      tags=["Doctors"])
router.include_router(patients_router,     prefix="/patients",     tags=["Patients"])
router.include_router(appointments_router, prefix="/appointments", tags=["Appointments"])
router.include_router(clinical_router,     prefix="/clinical",     tags=["Clinical"])
router.include_router(walkin_router,       prefix="/walkin",       tags=["Walk-In"])
router.include_router(reception_router,    prefix="/reception",    tags=["Reception"])
router.include_router(nurse_router,        prefix="/nurse",        tags=["Nurse"])
router.include_router(doctor_queue_router, prefix="/doctor",       tags=["Doctor Queue"])
router.include_router(medicines_router,    prefix="/medicines",    tags=["Medicines"])
router.include_router(prescriptions_router,prefix="/prescriptions",tags=["Prescriptions"])
router.include_router(lab_results_router,  prefix="/lab_results",  tags=["Lab Results"])
router.include_router(surgery_router,      prefix="/surgery",      tags=["Surgery & OT"])
router.include_router(pharmacy_router,     prefix="/pharmacy",     tags=["Pharmacy"])
router.include_router(ws_router)

# ── Dashboards & HR ───────────────────────────────────────────────────────────
router.include_router(owner_router,          prefix="/owner",    tags=["Owner Dashboard"])
router.include_router(doctor_extras_router,  prefix="/doctor",   tags=["Doctor Stats"])
router.include_router(patient_extras_router, prefix="/patient",  tags=["Patient Extras"])
router.include_router(billing_router,        prefix="/billing",  tags=["Billing"])
router.include_router(staff_router,          prefix="/staff",    tags=["Staff HR"])

# ── DPDP Compliance ───────────────────────────────────────────────────────────
router.include_router(consent_router,        prefix="/consent",  tags=["DPDP Compliance"])

# ── Doctor / Patient extensions ───────────────────────────────────────────────
router.include_router(doctor_ext_router,     prefix="/doctor",   tags=["Doctor Extensions"])
router.include_router(patient_ext_router,    prefix="/patients", tags=["Patient Extensions"])

# ── Partner (pharma / lab) — mounted at /partner ─────────────────────────────
# These are also mounted directly in main.py at /api/v1/partner for nginx routing
router.include_router(partner_auth_router,      prefix="/partner",           tags=["Partner Auth"])
router.include_router(partner_dashboard_router, prefix="/partner/dashboard", tags=["Partner Dashboard"])
router.include_router(partner_inventory_router, prefix="/partner/inventory", tags=["Partner Inventory"])
router.include_router(partner_orders_router,    prefix="/partner/orders",    tags=["Partner Orders"])
router.include_router(partner_referrals_router, prefix="/partner/referrals", tags=["Partner Referrals"])
router.include_router(partner_lab_router,       prefix="/partner/lab",       tags=["Partner Lab"])
router.include_router(partner_support_router,   prefix="/partner/support",   tags=["Partner Support"])
router.include_router(partner_queue_router,     prefix="/partner/queue",     tags=["Partner Queue"])
