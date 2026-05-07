from fastapi import APIRouter
from app.api.v1.endpoints import hospital

api_router = APIRouter()

# API V1 Routes
api_router.include_router(hospital.router, prefix="/hospital", tags=["Hospital Operations"])
