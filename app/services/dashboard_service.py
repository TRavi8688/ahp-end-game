import json
from datetime import datetime
import uuid
from typing import Optional, Dict, Any
from app.services.redis_service import redis_service
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import PatientDashboard, Patient, MedicalRecord, Condition, Medication, Allergy, AISummary, FamilyMember
from app.core.config import settings
from app.core.logging import logger

class DashboardService:
    """
    Enterprise-grade Dashboard Service.
    Implements multi-layer caching and profile-scoped clinical data aggregation.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self, hospital_id: Optional[uuid.UUID], patient_id: uuid.UUID, family_member_id: Optional[uuid.UUID] = None) -> Dict[str, Any]:
        """
        Retrieves patient or family member dashboard with profile-level isolation.
        """
        cache_key = f"dashboard:{patient_id}:{family_member_id}:{hospital_id}"
        
        # 1. Redis Tier
        try:
            cached = await redis_service.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.error(f"Redis retrieval failed for dashboard {patient_id}:{family_member_id}: {e}")

        # 2. Precomputed PostgreSQL Tier
        try:
            stmt = select(PatientDashboard).where(
                PatientDashboard.patient_id == patient_id,
                PatientDashboard.family_member_id == family_member_id
            )
            if hospital_id is not None:
                stmt = stmt.where(PatientDashboard.hospital_id == hospital_id)
            else:
                stmt = stmt.where(PatientDashboard.hospital_id.is_(None))
                
            result = await self.db.execute(stmt)
            db_dashboard = result.scalar_one_or_none()
            
            if db_dashboard:
                # Refresh Redis cache
                try:
                    await redis_service.set(cache_key, json.dumps(db_dashboard.data), expire=3600)
                except Exception:
                    pass
                return db_dashboard.data
        except Exception as e:
            logger.error(f"Postgres retrieval failed for dashboard {patient_id}:{family_member_id}: {e}")

        # 3. Fallback: Aggregation
        return await self.aggregate_dashboard_data(hospital_id, patient_id, family_member_id, persist=True)

    async def aggregate_dashboard_data(self, hospital_id: Optional[uuid.UUID], patient_id: uuid.UUID, family_member_id: Optional[uuid.UUID] = None, persist: bool = False) -> Dict[str, Any]:
        """
        Computes profile-scoped dashboard from raw clinical data.
        """
        # Fetch profile context
        if family_member_id:
            stmt = select(FamilyMember).where(FamilyMember.id == family_member_id, FamilyMember.patient_id == patient_id)
            profile = (await self.db.execute(stmt)).scalar_one_or_none()
            name = profile.full_name if profile else "Family Member"
            hospyn_id = profile.linked_hospyn_id or "CareCircle"
        else:
            stmt = select(Patient).where(Patient.id == patient_id).join(Patient.user)
            patient = (await self.db.execute(stmt)).scalar_one_or_none()
            if not patient:
                return {"error": "Patient profile not found"}
            name = f"{patient.user.first_name} {patient.user.last_name}"
            hospyn_id = patient.hospyn_id

        # Profile-Scoped clinical queries
        records_stmt = select(MedicalRecord).where(
            MedicalRecord.patient_id == patient_id,
            MedicalRecord.family_member_id == family_member_id
        ).order_by(MedicalRecord.created_at.desc()).limit(5)
        
        conditions_stmt = select(Condition).where(
            Condition.patient_id == patient_id,
            Condition.family_member_id == family_member_id,
            Condition.hidden_by_patient == False
        )
        
        meds_stmt = select(Medication).where(
            Medication.patient_id == patient_id,
            Medication.family_member_id == family_member_id,
            Medication.active == True
        )
        
        records = (await self.db.execute(records_stmt)).scalars().all()
        conditions = (await self.db.execute(conditions_stmt)).scalars().all()
        meds = (await self.db.execute(meds_stmt)).scalars().all()

        dashboard_data = {
            "profile": {
                "full_name": name,
                "hospyn_id": hospyn_id,
                "is_family_member": family_member_id is not None
            },
            "latest_records": [
                {
                    "id": r.id,
                    "type": r.type,
                    "summary": r.patient_summary or "Record available",
                    "date": r.created_at.isoformat()
                } for r in records
            ],
            "active_conditions": [{"name": c.name} for c in conditions],
            "current_medications": [{"name": m.generic_name, "dosage": m.dosage} for m in meds],
            "updated_at": datetime.now().isoformat()
        }

        if persist:
            # Upsert
            stmt = select(PatientDashboard).where(
                PatientDashboard.patient_id == patient_id,
                PatientDashboard.family_member_id == family_member_id
            )
            if hospital_id is not None:
                stmt = stmt.where(PatientDashboard.hospital_id == hospital_id)
            else:
                stmt = stmt.where(PatientDashboard.hospital_id.is_(None))
            
            res = await self.db.execute(stmt)
            db_dashboard = res.scalar_one_or_none()
            
            if db_dashboard:
                db_dashboard.data = dashboard_data
                db_dashboard.updated_at = datetime.utcnow()
            else:
                db_dashboard = PatientDashboard(
                    patient_id=patient_id,
                    family_member_id=family_member_id,
                    hospital_id=hospital_id,
                    data=dashboard_data
                )
                self.db.add(db_dashboard)
            
            await self.db.commit()

        return dashboard_data
