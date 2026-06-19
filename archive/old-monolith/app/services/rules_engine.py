from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.event_service import event_service
from app.core.logging import logger

class ClinicalRulesEngine:
    """
    Enterprise Rules Engine for Hospyn 2.0.
    Monitors the Clinical Event Stream to generate Derived Events.
    Powers real-time alerts, trend detection, and AI notifications.
    """

    async def process_lab_results(
        self,
        db: AsyncSession,
        tenant_id: int,
        patient_id: int,
        order_id: int,
        results: List[Dict[str, Any]],
        actor_id: int
    ):
        """
        Analyzes structured lab results to detect anomalies.
        Emits DERIVED_EVENTS for clinical alerts.
        """
        try:
            critical_hits = []
            abnormal_hits = []

            for res in results:
                flag = res.get("flag", "").upper()
                test_name = res.get("test_name", "Unknown Test")
                value = res.get("value")
                unit = res.get("unit")

                if flag == "CRITICAL":
                    critical_hits.append(f"{test_name}: {value} {unit}")
                elif flag in ["LOW", "HIGH"]:
                    abnormal_hits.append(f"{test_name}: {value} {unit} ({flag})")

            # 1. Emit Derived Event: ABNORMAL_RESULT_DETECTED
            if abnormal_hits:
                await event_service.log_event(
                    db=db,
                    tenant_id=tenant_id,
                    patient_id=patient_id,
                    actor_id=actor_id,
                    event_type="ABNORMAL_RESULT_DETECTED",
                    aggregate_type="lab_order",
                    aggregate_id=str(order_id),
                    payload={
                        "count": len(abnormal_hits),
                        "details": abnormal_hits,
                        "priority": "MEDIUM"
                    }
                )

            # 2. Emit Derived Event: CRITICAL_ALERT
            if critical_hits:
                await event_service.log_event(
                    db=db,
                    tenant_id=tenant_id,
                    patient_id=patient_id,
                    actor_id=actor_id,
                    event_type="CRITICAL_ALERT",
                    aggregate_type="lab_order",
                    aggregate_id=str(order_id),
                    payload={
                        "alert_type": "LAB_CRITICAL",
                        "details": critical_hits,
                        "priority": "HIGH"
                    }
                )
                
            logger.info(f"RULES_ENGINE: Processed Lab {order_id}. Critical: {len(critical_hits)}, Abnormal: {len(abnormal_hits)}")

        except Exception as e:
            logger.error(f"RULES_ENGINE_FAILURE: Failed to process lab {order_id}. Error: {e}")

rules_engine = ClinicalRulesEngine()
