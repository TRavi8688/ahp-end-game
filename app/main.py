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
print(">>> HOSPYN_IMPORT_BEGIN")
from app.core.config import settings
from app.core.logging import setup_logging, logger
import app.api.deps as deps

# Initialize structured logging instantly
setup_logging()
print(">>> HOSPYN_IMPORT_COMPLETE")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    SENIOR IR ENGINEER - RESILIENT STARTUP LIFESPAN:
    1. Binds the port instantly.
    2. Logs every stage of initialization.
    3. Graceful degradation: Survives DB/Secret failures.
    """
    boot_id = str(uuid.uuid4())[:8]
    logger.info(f"HOSPYN_BOOT_START [ID: {boot_id}] | ENV: {settings.ENVIRONMENT}")
    
    try:
        from app.core.database import get_writer_engine
        
        # STAGE 1: Infrastructure Connectivity
        logger.info(f"HOSPYN_BOOT_STAGE_1: Verifying Infrastructure [ID: {boot_id}]")
        try:
            engine = get_writer_engine()
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
            logger.info(f"HOSPYN_BOOT_DB_SUCCESS: Connection Established [ID: {boot_id}]")
        except Exception as db_e:
            logger.warning(f"HOSPYN_BOOT_DEGRADED: Database check failed (will retry): {db_e} [ID: {boot_id}]")
            app.state.boot_error = f"Database degraded: {db_e}"

        # STAGE 2: Service Verification
        logger.info(f"HOSPYN_BOOT_STAGE_2: Services Initialized [ID: {boot_id}]")
        
        logger.info(f"HOSPYN_BOOT_COMPLETE: FastAPI ready for Port Binding [ID: {boot_id}]")
    except Exception as e:
        logger.error(f"HOSPYN_BOOT_FATAL: Initialization Error: {e} [ID: {boot_id}]")
        app.state.boot_error = str(e)
        
    yield
    logger.info(f"HOSPYN_SHUTDOWN: Process {boot_id} Terminated.")

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
