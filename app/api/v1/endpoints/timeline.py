from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.api import deps
from app.models.models import User, ClinicalEvent
from sqlalchemy import select, desc

router = APIRouter()

@router.get("/timeline", response_model=List[Dict[str, Any]])
def get_clinical_timeline(
    *,
    db: Session = Depends(deps.get_db),
    hospital_id: int = Depends(deps.get_hospital_id),
    current_user: User = Depends(deps.get_db_user)
):
    """
    Retrieve the Longitudinal Clinical Timeline for the authenticated hospital context.
    This provides a unified, human-readable truth of all clinical actions.
    """
    try:
        # 1. Base query: All events for the tenant hospital
        stmt = select(ClinicalEvent).where(
            ClinicalEvent.tenant_id == hospital_id
        ).order_by(desc(ClinicalEvent.timestamp)).limit(100)
        
        # 2. Add role-based patient scoping
        if current_user.role == "doctor":
            # Doctors see events for patients they are assigned to (or all if in same hospital)
            pass
        elif current_user.role == "nurse":
            # Nurses see all hospital events
            pass
        
        result = db.execute(stmt)
        events = result.scalars().all()
        
        # 3. Transform events into a unified Timeline Feed
        feed = []
        for event in events:
            feed.append({
                "id": event.id,
                "type": event.event_type,
                "aggregate_type": event.aggregate_type,
                "timestamp": event.timestamp.isoformat(),
                "patient_id": event.patient_id,
                "actor_id": event.actor_id,
                "summary": _generate_event_summary(event)
            })
            
        return feed

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Timeline reconstruction failed: {str(e)}"
        )

def _generate_event_summary(event: ClinicalEvent) -> str:
    """Helper to convert raw events into human-readable timeline strings."""
    type_map = {
        "PRESCRIPTION_CREATED": "New digital prescription issued.",
        "PRESCRIPTION_FULFILLED": "Medication fulfilled by pharmacy.",
        "LAB_ORDER_CREATED": "Diagnostic lab tests ordered.",
        "LAB_STATUS_UPDATED": f"Lab order status updated to {event.payload.get('status', 'unknown')}.",
        "VITALS_RECORDED": "Patient vitals recorded."
    }
    return type_map.get(event.event_type, "Clinical action recorded.")
