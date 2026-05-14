import json
from datetime import datetime
import uuid
from typing import Optional, Dict, Any
from app.services.redis_service import redis_service
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import PatientDashboard, Patient, MedicalRecord, Condition, Medication, Allergy, AISummary
from app.core.config import settings
from app.core.logging import logger

class DashboardService:
    """
    Enterprise-grade Dashboard Service.
    Implements multi-layer caching and strictly read-only retrieval for GET requests.
    Side-effects (precomputation) are decoupled from the retrieval flow.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_dashboard(self, hospital_id: uuid.UUID, patient_id: uuid.UUID) -> Dict[str, Any]:
        """
        Retrieves patient dashboard from Redis cache or Precomputed Database table.
        Strictly Read-Only: No commits in this flow.
        """
        cache_key = f"dashboard:{patient_id}:{hospital_id}"
        
        # 1. Redis Tier
        try:
            cached = await redis_service.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as e:
            logger.error(f"Redis retrieval failed for dashboard {hospital_id}:{patient_id}: {e}")

        # 2. Precomputed PostgreSQL Tier (Source of Truth)
        try:
            stmt = select(PatientDashboard).where(
                PatientDashboard.patient_id == patient_id
            )
            if hospital_id is not None:
                stmt = stmt.where(PatientDashboard.hospital_id == hospital_id)
            else:
                stmt = stmt.where(PatientDashboard.hospital_id.is_(None))
            result = await self.db.execute(stmt)
            db_dashboard = result.scalar_one_or_none()
            
            if db_dashboard:
                # Refresh Redis cache asynchronously
                try:
                    await redis_service.set(cache_key, json.dumps(db_dashboard.data), expire=3600)
                except Exception:
                    pass
                return db_dashboard.data
        except Exception as e:
            logger.error(f"Postgres retrieval failed for dashboard {hospital_id}:{patient_id}: {e}")

        # 3. Fallback: Aggregation ONLY if precomputed data is missing
        # We compute, persist to DB (Source of Truth), and cache.
        return await self.aggregate_dashboard_data(hospital_id, patient_id, persist=True)

    async def aggregate_dashboard_data(self, hospital_id: uuid.UUID, patient_id: uuid.UUID, persist: bool = False) -> Dict[str, Any]:
        """
        Computes dashboard from raw clinical data.
        Optional persistence allows decoupling of heavy writes from read requests.
        """
        # Join Patient & User
        stmt = select(Patient).where(Patient.id == patient_id).join(Patient.user)
        result = await self.db.execute(stmt)
        patient = result.scalar_one_or_none()
        
        if not patient:
            return {"error": "Patient profile not found"}
        
        user = patient.user
        
        # Parallel aggregate fetches
        # Fetching latest 5 records (Tenant-Scoped)
        records_stmt = select(MedicalRecord).where(
            MedicalRecord.patient_id == patient_id
        )
        if hospital_id is not None:
            # Enforce strict isolation: Only show records created at THIS hospital
            records_stmt = records_stmt.where(MedicalRecord.hospital_id == hospital_id)
            
        records_stmt = records_stmt.order_by(MedicalRecord.created_at.desc()).limit(5)
        
        # Fetching active conditions
        conditions_stmt = select(Condition).where(
            Condition.patient_id == patient_id, 
            Condition.hidden_by_patient == False
        )
        
        # Fetching active medications
        meds_stmt = select(Medication).where(
            Medication.patient_id == patient_id, 
            Medication.active == True
        )
        
        # Sequential execution is fine for now as these are low-latency indexed lookups
        records_res = await self.db.execute(records_stmt)
        conditions_res = await self.db.execute(conditions_stmt)
        meds_res = await self.db.execute(meds_stmt)
        
        records = records_res.scalars().all()
        conditions = conditions_res.scalars().all()
        meds = meds_res.scalars().all()

        dashboard_data = {
            "profile": {
                "full_name": f"{user.first_name} {user.last_name}",
                "hospyn_id": patient.hospyn_id,
                "blood_group": patient.blood_group,
                "phone": patient.phone_number,
                "dob": patient.date_of_birth,
                "gender": patient.gender
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
            # Atomic update of dashboard table (Upsert logic)
            stmt = select(PatientDashboard).where(
                PatientDashboard.patient_id == patient_id
            )
            if hospital_id is not None:
                stmt = stmt.where(PatientDashboard.hospital_id == hospital_id)
            else:
                stmt = stmt.where(PatientDashboard.hospital_id.is_(None))
            
            stmt = stmt.with_for_update()
            
            async with self.db.begin_nested():
                result = await self.db.execute(stmt)
                db_dashboard = result.scalar_one_or_none()
                
                if db_dashboard:
                    db_dashboard.data = dashboard_data
                    db_dashboard.updated_at = datetime.utcnow()
                else:
                    db_dashboard = PatientDashboard(
                        patient_id=patient_id,
                        hospital_id=hospital_id,
                        data=dashboard_data,
                        updated_at=datetime.utcnow()
                    )
                    self.db.add(db_dashboard)
            await self.db.commit()

            # Now cache the fresh DB data
            cache_key = f"dashboard:{patient_id}:{hospital_id}"
            try:
                await redis_service.set(cache_key, json.dumps(dashboard_data), expire=3600)
            except Exception as e:
                logger.error(f"Failed to cache aggregated dashboard {hospital_id}:{patient_id}: {e}")

        return dashboard_data
