from fastapi import FastAPI
import logging

logger = logging.getLogger(__name__)

app = FastAPI(title="Hospyn IAM Service", version="1.0.0")

@app.get("/health")
async def health_check():
    """Independent health check for the IAM microservice."""
    return {"status": "ok", "service": "iam", "version": "1.0.0"}

@app.post("/auth/token")
async def generate_token():
    """
    Strangler Fig: This endpoint will eventually take over token generation 
    from the main monolith, offloading cryptographic overhead to this isolated service.
    """
    return {"access_token": "simulated_microservice_token", "token_type": "bearer"}

# In Phase 3, this service runs on its own Kubernetes pod and auto-scales 
# independently from the heavy data queries of the core monolith.
