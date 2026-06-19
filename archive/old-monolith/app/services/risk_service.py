from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import PatientRiskProfile, MedicalRecord, LabResult, PatientVisit
from sqlalchemy import select, desc
from app.core.logging import logger
import uuid
from datetime import datetime

class ClinicalRiskService:
    """
    PREDICTIVE CLINICAL AI ENGINE (Phase 4.2).
    The "Brain" of Hospyn. Analyzes history to predict future risks.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def update_patient_risk_profile(self, patient_id: uuid.UUID):
        """
        Runs a risk assessment for a patient based on their longitudinal data.
        """
        # 1. Fetch recent clinical data
        # In a real system, this would be passed to a specialized AI model.
        # Here we implement the heuristic foundation.
        
        # 2. Risk Heuristic: Deterioration Risk (based on abnormal labs)
        lab_stmt = select(LabResult).where(
            LabResult.patient_id == patient_id,
            LabResult.is_abnormal == True
        ).order_by(desc(LabResult.observation_date)).limit(10)
        abnormal_labs = (await self.db.execute(lab_stmt)).scalars().all()
        
        deterioration_score = len(abnormal_labs) * 0.1 # Simplified 10% risk per abnormal lab
        
        # 3. Risk Heuristic: No-Show Risk (based on past visits)
        visit_stmt = select(PatientVisit).where(PatientVisit.patient_id == patient_id)
        visits = (await self.db.execute(visit_stmt)).scalars().all()
        cancelled_visits = [v for v in visits if v.status == "cancelled"]
        
        no_show_score = (len(cancelled_visits) / len(visits)) if visits else 0.0

        # 4. UPSERT the Risk Profile
        stmt = select(PatientRiskProfile).where(PatientRiskProfile.patient_id == patient_id)
        profile = (await self.db.execute(stmt)).scalar_one_or_none()
        
        if not profile:
            profile = PatientRiskProfile(patient_id=patient_id)
            self.db.add(profile)

        profile.critical_deterioration_risk = min(deterioration_score, 1.0)
        profile.no_show_risk = no_show_score
        profile.last_evaluated_at = datetime.now()
        
        # Flag for intervention if risk is HIGH
        if profile.critical_deterioration_risk > 0.7:
            profile.alert_triggered = True
            profile.clinical_priority = "HIGH"
            logger.critical(f"PREDICTIVE_ALERT: High deterioration risk for Patient {patient_id}")

        await self.db.commit()
        return profile
