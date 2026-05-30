from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import OutboxEvent

def add_event_to_outbox(db: AsyncSession, event_dict: dict):
    """
    Inserts a transactional event into the outbox table.
    Should be called within an active transaction.
    """
    event = OutboxEvent(
        event_type=event_dict.get("event_type", "UNKNOWN"),
        event_version=event_dict.get("event_version", "v1"),
        tenant_id=event_dict.get("tenant_id"),
        trace_id=event_dict.get("trace_id", "none"),
        payload=event_dict.get("payload", {})
    )
    db.add(event)
