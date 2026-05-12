from datetime import datetime
import os
import sys
import logging
import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

# --- PHASE 4: STARTUP DIAGNOSTICS ---
print(f">>> [BOOT_STAGE: PROCESS_START] PID: {os.getpid()} | Python: {sys.version}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    ENTERPRISE SAFE-BOOT LIFESPAN:
    1. Binds the port immediately.
    2. Loads heavy clinical routers asynchronously.
    3. Initializes distributed services after the app is live.
    """
    boot_start = time.time()
    print(f">>> [BOOT_STAGE: LOADING_RESOURCES] Time: {datetime.utcnow().isoformat()}")
    
    try:
        # Lazy imports prevent top-level NameErrors/ImportErrors from blocking port binding
        from app.core.config import settings
        from app.api.v1.router import api_router as enterprise_v1_router
        from app.api import auth, patient, profile, doctor, admin, privacy, auth_onboarding, staff, governance
        
        # --- AUTO-SYNC DATABASE SCHEMA ---
        from app.models.models import Base
        from app.core.database import primary_engine
        async with primary_engine.begin() as conn:
            # We use checkfirst=True (default) to skip tables that already exist
            await conn.run_sync(Base.metadata.create_all)
            print(">>> [BOOT_STAGE: DB_SYNC_COMPLETE] All tables verified/created.")

        # Router registration after port binding
        app.include_router(auth.router, prefix=settings.API_V1_STR)
        app.include_router(patient.router, prefix=settings.API_V1_STR)
        app.include_router(profile.router, prefix=settings.API_V1_STR)
        app.include_router(enterprise_v1_router, prefix=settings.API_V1_STR)
        app.include_router(doctor.router, prefix=settings.API_V1_STR)
        app.include_router(admin.router, prefix=settings.API_V1_STR)
        app.include_router(privacy.router, prefix=settings.API_V1_STR)
        app.include_router(auth_onboarding.router, prefix=settings.API_V1_STR)
        app.include_router(staff.router, prefix=settings.API_V1_STR)
        app.include_router(governance.router, prefix=settings.API_V1_STR)
        
        print(f">>> [BOOT_STAGE: ROUTERS_LOADED] Latency: {time.time() - boot_start:.4f}s")
    except Exception as e:
        print(f">>> [BOOT_STAGE: FATAL_LOAD_ERROR] {e}")
        # We don't exit; we let the app stay alive so health checks can report the error details
        app.state.boot_error = str(e)
    
    yield
    print(f">>> [BOOT_STAGE: SHUTDOWN_INITIATED]")


from app.core.logging import setup_logging, logger

# Immediate setup
setup_logging()

app = FastAPI(
    title="Hospyn 2.0 Enterprise API", 
    version="2.0.8-SAFE-BOOT",
    lifespan=lifespan
)

# --- PHASE 2: INSTANT HEALTH ENDPOINTS ---

@app.get("/health")
@app.get("/readyz")
async def liveness_probe():
    """Returns instantly to satisfy Cloud Run readiness probes during cold starts."""
    boot_error = getattr(app.state, "boot_error", None)
    if boot_error:
@app.get("/health", tags=["Infrastructure"])
async def health_check():
    """Liveness Probe: Core process and memory health."""
    return {
        "status": "healthy",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }

@app.get("/readyz", tags=["Infrastructure"])
async def readiness_check(db: AsyncSession = Depends(deps.get_db)):
    """
    Readiness Probe: Deep Connectivity Check.
    Ensures DB Writer, DB Reader, and AI Engine are operational.
    Used for Blue/Green deployment gating.
    """
    results = {"db_writer": "ok", "db_reader": "ok", "ai_engine": "ok"}
    
    # 1. Check DB Writer
    try:
        from sqlalchemy import text
        await db.execute(text("SELECT 1"))
    except Exception as e:
        results["db_writer"] = f"error: {str(e)}"
        
    # 2. Check DB Reader
    try:
        from app.core.database import ReaderSession
        async with ReaderSession() as r_session:
            await r_session.execute(text("SELECT 1"))
    except Exception as e:
        results["db_reader"] = f"error: {str(e)}"

    # 3. Check AI Engine (Ping-only)
    from app.services.ai_service import get_ai_service
    ai = await get_ai_service()
    if not ai.gemini_key and not ai.groq_key:
        results["ai_engine"] = "degraded: no keys"

    status_code = 200 if all(v == "ok" or "degraded" in v for v in results.values()) else 503
    return JSONResponse(status_code=status_code, content={"status": "ready" if status_code == 200 else "not_ready", "checks": results})

from app.middleware.error_handler import global_exception_handler
from app.middleware.forensic_telemetry import ForensicTelemetryMiddleware

app.add_exception_handler(Exception, global_exception_handler)

# --- MIDDLEWARE (Order Matters: Telemetry -> Proxy -> CORS) ---
app.add_middleware(ForensicTelemetryMiddleware)
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
    # Dev/Test flexibility
    final_origins = ["*"] if "*" in allowed_origins else allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=final_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WEBSOCKET BRIDGE ---

@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    from app.core.security import decode_token
    from app.core.realtime import manager
    
    payload = decode_token(token, token_type="access")
    if not payload:
        await websocket.accept()
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = payload.get("sub")
    await manager.connect(user_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(user_id, websocket)

print(">>> [BOOT_STAGE: APPLICATION_READY] Port listening sequence starting...")
