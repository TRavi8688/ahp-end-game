from app.api.v1.endpoints import hospital, queue, admission, clinical, timeline, pharmacy, admin

api_router = APIRouter()

# API V1 Routes
api_router.include_router(admin.router, prefix="/admin", tags=["Super Admin Operations"])
api_router.include_router(hospital.router, prefix="/hospital", tags=["Hospital Operations"])
api_router.include_router(queue.router, prefix="/queue", tags=["Queue Engine"])
api_router.include_router(admission.router, prefix="/admissions", tags=["Admissions Workflow"])
api_router.include_router(clinical.router, prefix="/clinical", tags=["Clinical Operations"])
api_router.include_router(timeline.router, prefix="/clinical", tags=["Clinical Journey"])
api_router.include_router(pharmacy.router, prefix="/pharmacy", tags=["Pharmacy Inventory"])
