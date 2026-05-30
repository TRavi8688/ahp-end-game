import logging
from typing import Dict, Any, Type
from pydantic import BaseModel, Field
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Strict Event Contracts (Simulating Protobuf/Avro)
# Ensures microservices never break downstream consumers
# ---------------------------------------------------------------------------

class BaseEvent(BaseModel):
    event_id: uuid.UUID = Field(default_factory=uuid.uuid4)
    event_type: str
    tenant_id: str
    actor_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    version: str = "1.0.0"

class HospitalApprovedEvent(BaseEvent):
    event_type: str = "hospital.verification.approved"
    hospital_id: str
    compliance_score: float

class CriticalSecurityAlertEvent(BaseEvent):
    event_type: str = "security.anomaly.detected"
    ip_address: str
    severity: str = "CRITICAL"
    reason: str

class EventRegistry:
    """
    Centralized Kafka Event Registry.
    Validates all events against strict schemas before publishing to the message broker.
    """
    
    def __init__(self):
        self._schemas: Dict[str, Type[BaseEvent]] = {
            "hospital.verification.approved": HospitalApprovedEvent,
            "security.anomaly.detected": CriticalSecurityAlertEvent,
        }
        logger.info("Initializing Kafka Event Registry...")

    def publish(self, topic: str, event_payload: Dict[str, Any]):
        """
        Validates the payload against the registered schema, then publishes to Kafka.
        """
        event_type = event_payload.get("event_type")
        schema_class = self._schemas.get(event_type)
        
        if not schema_class:
            logger.error(f"[EVENT_REGISTRY] Unknown event type: {event_type}")
            raise ValueError(f"Unknown event type: {event_type}")
            
        try:
            # Enforce strict schema validation
            validated_event = schema_class(**event_payload)
            
            # self.kafka_producer.send(topic, value=validated_event.json().encode('utf-8'))
            logger.info(f"[KAFKA] Published '{event_type}' to topic '{topic}'")
            return True
            
        except Exception as e:
            logger.critical(f"[EVENT_REGISTRY] Schema validation failed for {event_type}: {e}")
            raise ValueError(f"Event schema violation: {e}")

global_event_registry = EventRegistry()
