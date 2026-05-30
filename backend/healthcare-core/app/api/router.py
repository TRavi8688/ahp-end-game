"""
Healthcare Core API Router

Aggregates all v1 routers into a single root router.
"""
from fastapi import APIRouter

from app.api.v1.hospitals import router as hospitals_router
from app.api.v1.doctors import router as doctors_router
from app.api.v1.patients import router as patients_router
from app.api.v1.appointments import router as appointments_router
from app.api.v1.clinical import router as clinical_router
from app.api.v1.walkin import router as walkin_router
from app.api.v1.reception import router as reception_router
from app.api.v1.nurse import router as nurse_router
from app.api.v1.doctor_queue import router as doctor_queue_router
from app.api.v1.ws_endpoint import router as ws_router
from app.api.v1.medicines import router as medicines_router

router = APIRouter()

router.include_router(hospitals_router, prefix="/hospitals", tags=["Hospitals"])
router.include_router(doctors_router, prefix="/doctors", tags=["Doctors"])
router.include_router(patients_router, prefix="/patients", tags=["Patients"])
router.include_router(appointments_router, prefix="/appointments", tags=["Appointments"])
router.include_router(clinical_router, prefix="/clinical", tags=["Clinical"])
router.include_router(walkin_router, prefix="/walkin", tags=["Walk-In"])
router.include_router(reception_router, prefix="/reception", tags=["Reception"])
router.include_router(nurse_router, prefix="/nurse", tags=["Nurse"])
router.include_router(doctor_queue_router, prefix="/doctor", tags=["Doctor Queue"])
router.include_router(medicines_router, prefix="/medicines", tags=["Medicines"])
router.include_router(ws_router)

