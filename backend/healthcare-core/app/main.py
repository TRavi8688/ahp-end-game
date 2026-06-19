"""
backend/healthcare-core/app/main.py

WHAT CHANGED vs existing file:
  - Added direct mount of super_admin_router at /api/v1/admin
    (nginx routes /api/v1/admin/ → gateway → this service)
  - Added direct mount of partner routers at /api/v1/partner
    (nginx routes /api/v1/partner/ → gateway → this service)
  - Added direct mount of staff router at /api/v1/staff
    (nginx routes /api/v1/staff/ → gateway → this service; HR portal calls /api/v1/staff/*)
  - Kept existing /api/v1 mount for all hospital-facing routes
  - CORS now reads from env (was hardcoded)
"""

import logging
import os

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import router as api_router
from app.config.settings import settings

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Hospyn Healthcare Core API",
    description="Healthcare management platform API",
    version="2.0.0",
    docs_url="/docs" if os.getenv("ENV", "development") != "production" else None,
    redoc_url=None,
)


# ─── CORS ─────────────────────────────────────────────────────────────────────
def configure_cors(application: FastAPI) -> None:
    raw_origins = os.environ.get("ALLOWED_ORIGINS", "").strip()
    if not raw_origins:
        raw_origins = settings.ALLOWED_ORIGINS
    if not raw_origins:
        raw_origins = "http://localhost:3000,http://localhost:5173"

    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    logger.info("CORS allowed origins: %s", origins)

    application.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )


configure_cors(app)


# ─── Health check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "service": "healthcare-core", "version": "2.0.0"}


# ─── Main API — hospital-facing (prefixed /api/v1/healthcare/ in nginx) ───────
# All clinical endpoints: /hospitals, /doctors, /patients, /appointments, etc.
app.include_router(api_router, prefix="/api/v1")


# ─── Super Admin direct mount ─────────────────────────────────────────────────
# FIXED: nginx routes /api/v1/admin/ → gateway → this service
# The super-admin dashboard calls /api/v1/admin/analytics/overview,
# /api/v1/admin/hospitals, /api/v1/admin/users, etc.
# Without this block, every super-admin request returned nginx 404.
from app.api.v1.super_admin import router as super_admin_router
app.include_router(super_admin_router, prefix="/api/v1/admin", tags=["Super Admin"])


# ─── Partner direct mount ─────────────────────────────────────────────────────
# FIXED: nginx routes /api/v1/partner/ → gateway → this service
# Partner web app and mobile app call /api/v1/partner/auth/login,
# /api/v1/partner/inventory, /api/v1/partner/orders, /api/v1/partner/referrals
# Without this block, entire partner app returned nginx 404.
from app.api.v1.partner_auth      import router as partner_auth_router
from app.api.v1.partner_dashboard import router as partner_dashboard_router
from app.api.v1.partner_inventory import router as partner_inventory_router
from app.api.v1.partner_orders    import router as partner_orders_router
from app.api.v1.partner_referrals import router as partner_referrals_router
from app.api.v1.partner_lab       import router as partner_lab_router
from app.api.v1.partner_support   import router as partner_support_router
from app.api.v1.partner_queue     import router as partner_queue_router

app.include_router(partner_auth_router,      prefix="/api/v1/partner",           tags=["Partner Auth"])
app.include_router(partner_dashboard_router, prefix="/api/v1/partner/dashboard", tags=["Partner Dashboard"])
app.include_router(partner_inventory_router, prefix="/api/v1/partner/inventory", tags=["Partner Inventory"])
app.include_router(partner_orders_router,    prefix="/api/v1/partner/orders",    tags=["Partner Orders"])
app.include_router(partner_referrals_router, prefix="/api/v1/partner/referrals", tags=["Partner Referrals"])
app.include_router(partner_lab_router,       prefix="/api/v1/partner/lab",       tags=["Partner Lab"])
app.include_router(partner_support_router,   prefix="/api/v1/partner/support",   tags=["Partner Support"])
app.include_router(partner_queue_router,     prefix="/api/v1/partner/queue",     tags=["Partner Queue"])


# ─── Staff/HR direct mount ─────────────────────────────────────────────────────
# FIXED: nginx routes /api/v1/staff/ → gateway → this service
# HR portal calls /api/v1/staff/list, /api/v1/staff/shifts, /api/v1/staff/leaves
# Without this block, HR portal returned nginx 404 for all staff data.
from app.api.v1.staff import router as staff_direct_router
app.include_router(staff_direct_router, prefix="/api/v1/staff", tags=["Staff HR Direct"])
