from fastapi import FastAPI, BackgroundTasks
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="Hospyn Billing Service", version="1.0.0")

@app.get("/health")
async def health_check():
    """Independent health check for the Billing microservice."""
    return {"status": "ok", "service": "billing"}

@app.post("/webhooks/stripe")
async def stripe_webhook(payload: dict, background_tasks: BackgroundTasks):
    """
    Strangler Fig: Moving external webhook processing out of the core monolith.
    This microservice will listen to Stripe events and emit internal Kafka events 
    (e.g., 'hospital.subscription.activated').
    """
    logger.info(f"Received Stripe Event: {payload.get('type')}")
    # background_tasks.add_task(publish_to_kafka, payload)
    return {"status": "received"}

# In Phase 3, extracting Billing to a separate microservice prevents a high-CPU 
# core analytics query from slowing down critical payment webhooks.
