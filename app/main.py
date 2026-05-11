import os
from datetime import datetime
import logging
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.core.config import settings
from app.core.logging import setup_logging, logger

# 1. Standard Logging
setup_logging()

app = FastAPI(title=settings.PROJECT_NAME, version=settings.VERSION)

@app.get("/")
async def root():
    return {"message": "Welcome to Hospyn 2.0 - RESILIENT-V3", "version": settings.VERSION}

@app.get("/health")
@app.get("/readyz")
async def health_check():
    return {
        "status": "ready", 
        "version": settings.VERSION, 
        "timestamp": datetime.utcnow().isoformat(),
        "database": "configured" if settings.DATABASE_URL else "missing"
    }

# --- MIDDLEWARE ---
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Temporarily open to confirm boot
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTERS (Wrapped in try/except for forensic boot) ---
try:
    from app.api.v1.router import api_router as enterprise_v1_router
    from app.api import auth, patient, profile, doctor, admin
    
    app.include_router(enterprise_v1_router, prefix=settings.API_V1_STR)
    app.include_router(auth.router, prefix=settings.API_V1_STR)
    app.include_router(patient.router, prefix=settings.API_V1_STR)
    app.include_router(profile.router, prefix=settings.API_V1_STR)
    app.include_router(doctor.router, prefix=settings.API_V1_STR)
    app.include_router(admin.router, prefix=settings.API_V1_STR)
    logger.info("BOOT_SUCCESS: All routers loaded.")
except Exception as e:
    logger.error(f"BOOT_WARNING: Some routers failed to load: {e}")

logger.info("SYSTEM_READY: Resilient-V3 initialized.")
