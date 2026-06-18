import structlog
from datetime import datetime, timezone

logger = structlog.get_logger()


def log_audit_event(
    action: str,
    actor_id: str,
    target_id: str = None,
    details: dict = None,
    ip_address: str = None,
    request_id: str = None,
):
    """
    Emits an immutable audit event to standard output as structured JSON.
    GCP Cloud Logging (Stackdriver) ingests this and it can be routed to a secure
    audit bucket via Log Router sinks.

    Args:
        action (str): The action performed (e.g., 'user_login', 'doctor_approved', 'patient_record_accessed').
        actor_id (str): ID of the user performing the action.
        target_id (str, optional): ID of the entity being acted upon (e.g., another user ID or appointment ID).
        details (dict, optional): Additional contextual metadata.
        ip_address (str, optional): The IP address of the actor.
        request_id (str, optional): Correlation/request ID for tracing.
    """
    event_payload = {
        "event_type": "audit",
        "action": action,
        "actor_id": actor_id,
        "target_id": target_id,
        "details": details or {},
        "ip_address": ip_address,
        "request_id": request_id,
        "timestamp_utc": datetime.now(timezone.utc).isoformat(),
    }

    # We log at INFO level with a specific event name so it's easily filterable in GCP.
    logger.info("AUDIT_EVENT", **event_payload)
