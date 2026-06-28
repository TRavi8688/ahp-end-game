"""
backend/healthcare-core/app/api/v1/matrix_router.py

Hospin Matrix 3.0 -- Master Router
Mounts all Matrix module endpoints under /api/v1/matrix/

ADD TO: backend/healthcare-core/app/api/router.py

    from app.api.v1.matrix_router import matrix_router
    api_router.include_router(matrix_router, prefix="/matrix", tags=["Matrix 3.0"])

AND in main.py lifespan, after init_redis:

    from app.services.matrix_sla_engine import run_sla_worker
    asyncio.create_task(run_sla_worker())
"""
from fastapi import APIRouter

from app.api.v1.matrix_mission import router as mission_router
from app.api.v1.matrix_ops     import router as ops_router
from app.services.matrix_sla_engine import router as sla_router

matrix_router = APIRouter()

# MODULE 1: Mission Control
matrix_router.include_router(mission_router, prefix="/mission", tags=["Mission Control"])

# MODULES 5-7: Workforce / Shift / Workload
# MODULES 15: Incident War Room
# MODULES 16: IAM Governance
# MODULES 17: Verification
# MODULES 18: Financial
# MODULES 19: Broadcasts / Audit
# MODULES 20: AI Log
matrix_router.include_router(ops_router, tags=["Matrix Operations"])

# MODULES 8-9: SLA Engine + Escalation
matrix_router.include_router(sla_router, prefix="/sla", tags=["SLA Engine"])
