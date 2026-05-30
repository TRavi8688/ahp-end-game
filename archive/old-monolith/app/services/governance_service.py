from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from app.models.models import ClinicalAIEvent, ClinicianOverride, AISafetyMode
from typing import Dict, List, Any
import uuid

class ClinicalGovernanceService:
    """
    ENTERPRISE GOVERNANCE CONSOLE:
    Aggregates safety and forensic data for clinical accountability reports.
    """
    
    @staticmethod
    async def get_safety_dashboard_metrics(db: AsyncSession, hospital_id: uuid.UUID) -> Dict[str, Any]:
        """
        Retrieves high-level safety KPIs for hospital administrators.
        """
        # 1. AI Override Rate
        total_ai_events = await db.scalar(
            select(func.count(ClinicalAIEvent.id)).where(ClinicalAIEvent.hospital_id == hospital_id)
        ) or 0
        
        overridden_events = await db.scalar(
            select(func.count(ClinicalAIEvent.id))
            .where(ClinicalAIEvent.hospital_id == hospital_id, ClinicalAIEvent.overridden == True)
        ) or 0
        
        override_rate = (overridden_events / total_ai_events * 100) if total_ai_events > 0 else 0
        
        # 2. Provider Reliability (Success vs Circuit Trips)
        # (This would ideally query the metrics system or a provider_health table)
        
        # 3. Confidence Distribution
        # In a real system, we'd use JSONB functions to aggregate confidence_score
        
        return {
            "total_clinical_ai_interactions": total_ai_events,
            "clinician_override_count": overridden_events,
            "override_rate_percentage": round(override_rate, 2),
            "safety_posture": "HEALTHY" if override_rate < 5 else "REVIEW_REQUIRED"
        }

    @staticmethod
    async def get_top_overrides(db: AsyncSession, hospital_id: uuid.UUID, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Identifies specific AI prompts that doctors frequently correct.
        Used for provider-tuning and safety-patching.
        """
        stmt = (
            select(ClinicalAIEvent.prompt_template, func.count(ClinicianOverride.id).label("override_count"))
            .join(ClinicianOverride, ClinicalAIEvent.id == ClinicianOverride.ai_event_id)
            .where(ClinicalAIEvent.hospital_id == hospital_id)
            .group_by(ClinicalAIEvent.prompt_template)
            .order_by(desc("override_count"))
            .limit(limit)
        )
        result = await db.execute(stmt)
        return [{"template": row[0], "count": row[1]} for row in result.all()]

    @staticmethod
    async def get_provider_performance(db: AsyncSession, hospital_id: uuid.UUID) -> List[Dict[str, Any]]:
        """
        Compares latency and confidence across providers (Gemini, Anthropic, etc.)
        """
        stmt = (
            select(
                ClinicalAIEvent.provider, 
                func.avg(ClinicalAIEvent.latency_ms).label("avg_latency"),
                func.count(ClinicalAIEvent.id).label("total_calls")
            )
            .where(ClinicalAIEvent.hospital_id == hospital_id)
            .group_by(ClinicalAIEvent.provider)
        )
        result = await db.execute(stmt)
        return [
            {
                "provider": row[0], 
                "avg_latency": round(row[1], 2), 
                "total_calls": row[2]
            } for row in result.all()
        ]

governance_service = ClinicalGovernanceService()
