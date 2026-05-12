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
        return JSONResponse(
            status_code=503, 
            content={"status": "degraded", "reason": "boot_failure", "detail": boot_error}
        )
    return {"status": "ready", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/v1/health/deep")
async def deep_health_check():
    """Separated active connectivity check."""
    from app.core.database import primary_engine
    from sqlalchemy import text
    try:
        async with primary_engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            return {"status": "connected", "database": "verified"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "disconnected", "error": str(e)})

# --- EXCEPTION HANDLERS ---

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("RUNTIME_ERROR")
    return JSONResponse(status_code=500, content={"detail": {"error_code": "INTERNAL_SERVER_ERROR", "message": str(exc)}})

# --- MIDDLEWARE ---
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts=["*"])

# CORS (Hardened for Production)
from app.core.config import settings
allowed_origins = settings.ALLOWED_ORIGINS

# If using allow_credentials=True, origins MUST NOT be ["*"]
# We sanitize this here to prevent FastAPI/Uvicorn startup crashes
is_wildcard = "*" in allowed_origins
final_origins = ["*"] if is_wildcard else allowed_origins

if not is_wildcard:
    final_origins.extend([
        "https://hospyn-495906-96438.web.app",
        "https://hospyn-495906.web.app",
        "https://app.hospyn.com"
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=final_origins,
    allow_credentials=not is_wildcard,  # Must be false if origin is "*"
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# --- GLOBAL EXCEPTION HANDLER (CORS AWARE) ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Ensures that even on a 500 crash, we return JSON and attempt to preserve CORS headers.
    """
    logger.exception(f"UNHANDLED_EXCEPTION: {str(exc)}")
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": {
                "error_code": "INTERNAL_SERVER_ERROR",
                "message": "A critical backend error occurred.",
                "trace": str(exc) if settings.ENVIRONMENT == "development" else None
            }
        }
    )
    # Manually re-apply CORS headers if middleware was bypassed by the crash
    origin = request.headers.get("origin")
    if origin:
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    
    return response

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
