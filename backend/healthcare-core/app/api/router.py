# backend/healthcare-core/app/api/router.py
# Central API router. All partner routes registered here.

from fastapi import APIRouter

from app.api.v1.partner_auth       import router as partner_auth_router
from app.api.v1.partner_dashboard  import router as partner_dashboard_router
from app.api.v1.partner_inventory  import router as partner_inventory_router
from app.api.v1.partner_orders     import router as partner_orders_router
from app.api.v1.partner_referrals  import router as partner_referrals_router
from app.api.v1.partner_queue      import router as partner_queue_router      # NEW
from app.api.v1.partner_lab        import router as partner_lab_router        # NEW
from app.api.v1.partner_support    import router as partner_support_router    # NEW

api_router = APIRouter()

# Partner app routes — all under /api/v1/partner/
api_router.include_router(partner_auth_router,      prefix="/partner", tags=["Partner Auth"])
api_router.include_router(partner_dashboard_router, prefix="/partner", tags=["Partner Dashboard"])
api_router.include_router(partner_inventory_router, prefix="/partner", tags=["Partner Inventory"])
api_router.include_router(partner_orders_router,    prefix="/partner", tags=["Partner Orders"])
api_router.include_router(partner_referrals_router, prefix="/partner", tags=["Partner Referrals"])
api_router.include_router(partner_queue_router,     prefix="/partner", tags=["Partner Queue"])
api_router.include_router(partner_lab_router,       prefix="/partner", tags=["Partner Lab"])
api_router.include_router(partner_support_router,   prefix="/partner", tags=["Partner Support"])
