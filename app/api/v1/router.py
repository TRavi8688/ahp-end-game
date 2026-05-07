from fastapi import APIRouter
from app.api.v1.endpoints import hospital, queue, admission

api_router = APIRouter()

# API V1 Routes
api_router.include_router(hospital.router, prefix="/hospital", tags=["Hospital Operations"])
api_router.include_router(queue.router, prefix="/queue", tags=["Queue Engine"])
api_router.include_router(admission.router, prefix="/admissions", tags=["Admissions Workflow"])
