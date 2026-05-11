import os
from datetime import datetime
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Minimal logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hospyn_minimal")

app = FastAPI(title="Hospyn 2.0 Minimal Debug")

@app.get("/")
async def root():
    return {"message": "Welcome to Hospyn 2.0 - MINIMAL-DEBUG-V1"}

@app.get("/health")
@app.get("/readyz")
async def health_check():
    return {"status": "ready", "version": "MINIMAL-V1", "timestamp": datetime.utcnow().isoformat()}

# Standard CORS for the debug phase
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Temporarily open for debug to confirm boot
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info("MINIMAL_SYSTEM_READY: Listening on port...")
