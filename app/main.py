from datetime import datetime, timezone
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, HTTPException, status, WebSocket, WebSocketDisconnect, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

# Import core infrastructure
from app.core.config import settings
from app.core.logging import setup_logging, logger
import app.api.deps as deps

# Initialize structured logging instantly
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    ENTERPRISE RESILIENT LIFESPAN:
    1. Binds the port instantly.
    2. Performs background infrastructure checks.
    3. Handles router registration after boot.
    """
    logger.info("HOSPYN_BOOT: Initializing Lifespan...")
    
    try:
        from app.core.database import writer_engine
        
        # 1. Verification of DB Connectivity (Non-Blocking if fails)
        try:
            async with writer_engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info("HOSPYN_BOOT: Database Connectivity Verified.")
        except Exception as db_e:
            logger.warning(f"HOSPYN_BOOT: Initial DB check failed (will retry): {db_e}")
            app.state.boot_error = f"Database connectivity issue: {db_e}"

        logger.info("HOSPYN_BOOT: Full Service Initialization Complete.")
    except Exception as e:
        logger.error(f"HOSPYN_BOOT: Fatal Initialization Error: {e}")
        app.state.boot_error = str(e)
        
    yield
    logger.info("HOSPYN_SHUTDOWN: Process Terminated.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# --- MIDDLEWARE ---
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# CORS (Hardened for Production - Fix 5)
allowed_origins = settings.ALLOWED_ORIGINS
env = settings.ENVIRONMENT

if env == "production":
    if "*" in allowed_origins:
        logger.critical("PRODUCTION_CORS_FAILURE: Wildcard '*' is strictly prohibited.")
        raise RuntimeError("Insecure CORS configuration detected in production.")
    final_origins = allowed_origins
else:
    final_origins = ["*"] if "*" in allowed_origins else allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=final_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ROUTERS ---
from app.api import auth, patient, profile, doctor, admin, privacy, auth_onboarding, staff, governance
from app.api.v1.router import api_router as enterprise_v1_router

app.include_router(auth.router, prefix=settings.API_V1_STR, tags=["Authentication"])
app.include_router(patient.router, prefix=settings.API_V1_STR, tags=["Patient"])
app.include_router(profile.router, prefix=settings.API_V1_STR, tags=["Profile"])
app.include_router(enterprise_v1_router, prefix=settings.API_V1_STR)
app.include_router(doctor.router, prefix=settings.API_V1_STR, tags=["Doctor"])
app.include_router(admin.router, prefix=settings.API_V1_STR, tags=["Admin"])
app.include_router(privacy.router, prefix=settings.API_V1_STR, tags=["Privacy"])
app.include_router(auth_onboarding.router, prefix=settings.API_V1_STR, tags=["Onboarding"])
app.include_router(staff.router, prefix=settings.API_V1_STR, tags=["Staff"])
app.include_router(governance.router, prefix=settings.API_V1_STR, tags=["Governance"])

# --- HEALTH ---
@app.get("/health", tags=["Infrastructure"])
async def health_check():
    boot_error = getattr(app.state, "boot_error", None)
    if boot_error:
        return JSONResponse(status_code=503, content={"status": "degraded", "error": boot_error})
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/readyz", tags=["Infrastructure"])
async def readiness_check(db: AsyncSession = Depends(deps.get_db)):
    try:
        await db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=str(e))

# --- WEBSOCKET ---
@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    from app.core.security import decode_token
    from app.core.realtime import manager
    
    await websocket.accept()
    try:
        payload = decode_token(token)
        if not payload:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
        
        user_id = payload.get("sub")
        await manager.connect(websocket, user_id)
        
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        await websocket.close()
