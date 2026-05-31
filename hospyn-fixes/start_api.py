"""
API Gateway — start_api.py (fixed)
Fixes applied:
  - CORS: no wildcard default; app refuses to start if ALLOWED_ORIGINS not set
  - PYTHONPATH: Linux colon separator, not Windows semicolon
  - subprocess.Popen: shell=False
  - Startup wait: health-check polling, not time.sleep(2)
  - Gateway: JWT presence check middleware before proxying
  - Unknown paths: return 404, not forward to healthcare-core
"""
import asyncio
import logging
import os
import subprocess
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
import uvicorn
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger("hospyn.gateway")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

# ---------------------------------------------------------------------------
# Configuration — all from environment, no hardcoded defaults for secrets
# ---------------------------------------------------------------------------

def _require_env(key: str, default: str | None = None) -> str:
    val = os.environ.get(key, default or "").strip()
    if not val:
        raise RuntimeError(
            f"Required environment variable '{key}' is not set. "
            "Cannot start gateway with missing configuration."
        )
    return val


def _get_cors_origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS", "").strip()
    if not raw or raw == "*":
        if os.environ.get("ENV", "production") == "development":
            logger.warning(
                "ALLOWED_ORIGINS not set — defaulting to localhost:3000 for development only"
            )
            return ["http://localhost:3000", "http://localhost:5173"]
        raise RuntimeError(
            "ALLOWED_ORIGINS environment variable must be set to a comma-separated list "
            "of allowed origins (e.g. https://app.hospyn.com). "
            "Wildcard '*' is never allowed in production."
        )
    origins = [o.strip() for o in raw.split(",") if o.strip()]
    logger.info(f"CORS allowed origins: {origins}")
    return origins


# Public paths that don't require a JWT
PUBLIC_PATHS = {
    "/api/v1/auth/login",
    "/api/v1/auth/register",
    "/api/v1/auth/otp/send",
    "/api/v1/auth/otp/verify",
    "/api/v1/auth/refresh",
    "/health",
    "/docs",
    "/openapi.json",
}

AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL", "http://localhost:8001")
HEALTHCARE_SERVICE_URL = os.environ.get("HEALTHCARE_SERVICE_URL", "http://localhost:8002")
GATEWAY_PORT = int(os.environ.get("PORT", "8000"))
DOCKER_ENV = os.environ.get("DOCKER_ENV", "false").lower() == "true"


# ---------------------------------------------------------------------------
# Service registry — configuration-driven routing (no elif sprawl)
# ---------------------------------------------------------------------------
SERVICE_ROUTES: dict[str, str] = {
    "auth": AUTH_SERVICE_URL,
    "healthcare": HEALTHCARE_SERVICE_URL,
    # Add new services here as: "pharmacy": PHARMACY_SERVICE_URL
}


# ---------------------------------------------------------------------------
# Health-check based startup wait (replaces time.sleep(2))
# ---------------------------------------------------------------------------
async def wait_for_service(name: str, url: str, timeout: int = 30) -> bool:
    health_url = f"{url}/health"
    deadline = time.time() + timeout
    async with httpx.AsyncClient() as client:
        while time.time() < deadline:
            try:
                r = await client.get(health_url, timeout=2.0)
                if r.status_code == 200:
                    logger.info(f"✓ {name} ready at {url}")
                    return True
            except Exception:
                pass
            await asyncio.sleep(1)
    logger.error(f"✗ {name} did not become ready within {timeout}s")
    return False


# ---------------------------------------------------------------------------
# Subprocess launch — shell=False, Linux PYTHONPATH
# ---------------------------------------------------------------------------
_procs: list[subprocess.Popen] = []


def start_service(name: str, module: str, port: int, cwd: Path) -> subprocess.Popen:
    env = os.environ.copy()
    # Linux uses ':', not ';' (Windows) as PATH separator
    env["PYTHONPATH"] = f".:.."
    env["PORT"] = str(port)
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", f"{module}:app",
         "--host", "0.0.0.0", "--port", str(port), "--workers", "1"],
        cwd=str(cwd),
        env=env,
        shell=False,  # Never shell=True with a list
    )
    logger.info(f"Started {name} (PID {proc.pid}) on port {port}")
    return proc


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    if not DOCKER_ENV:
        # Local dev mode: launch sub-services as processes
        base = Path(__file__).parent
        auth_dir = base / "backend" / "auth-service"
        hc_dir = base / "backend" / "healthcare-core"
        if auth_dir.exists():
            _procs.append(start_service("auth-service", "app.main", 8001, auth_dir))
        if hc_dir.exists():
            _procs.append(start_service("healthcare-core", "app.main", 8002, hc_dir))
        # Wait for services to be healthy (not a fixed sleep)
        await asyncio.gather(
            wait_for_service("auth-service", AUTH_SERVICE_URL),
            wait_for_service("healthcare-core", HEALTHCARE_SERVICE_URL),
        )
    yield
    # Graceful shutdown
    for p in _procs:
        p.terminate()
        try:
            p.wait(timeout=10)
        except subprocess.TimeoutExpired:
            p.kill()


app = FastAPI(title="Hospyn API Gateway", lifespan=lifespan)

# ---------------------------------------------------------------------------
# CORS middleware — strict, no wildcard
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_cors_origins(),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
)


# ---------------------------------------------------------------------------
# JWT presence middleware — block unauthenticated requests before proxying
# ---------------------------------------------------------------------------
@app.middleware("http")
async def require_auth(request: Request, call_next):
    path = request.url.path
    if path in PUBLIC_PATHS or request.method == "OPTIONS":
        return await call_next(request)
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JSONResponse(
            status_code=401,
            content={"detail": "Authorization header missing or invalid"},
        )
    return await call_next(request)


# ---------------------------------------------------------------------------
# Proxy helper
# ---------------------------------------------------------------------------
async def proxy_request(request: Request, target_url: str) -> Response:
    body = await request.body()
    headers = dict(request.headers)
    headers.pop("host", None)
    headers["X-Forwarded-For"] = request.client.host if request.client else "unknown"

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.request(
                method=request.method,
                url=target_url,
                headers=headers,
                content=body,
                params=request.query_params,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )
        except httpx.ConnectError:
            return JSONResponse(status_code=503, content={"detail": "Upstream service unavailable"})
        except httpx.TimeoutException:
            return JSONResponse(status_code=504, content={"detail": "Upstream service timed out"})


# ---------------------------------------------------------------------------
# Routing — configuration-driven, no catch-all to wrong service
# ---------------------------------------------------------------------------
@app.api_route(
    "/api/v1/{service}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"],
)
async def route_request(request: Request, service: str, path: str):
    if service not in SERVICE_ROUTES:
        return JSONResponse(
            status_code=404,
            content={"detail": f"Unknown service '{service}'. Available: {list(SERVICE_ROUTES.keys())}"},
        )
    base_url = SERVICE_ROUTES[service]
    target = f"{base_url}/api/v1/{service}/{path}"
    return await proxy_request(request, target)


# ---------------------------------------------------------------------------
# Health endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
async def gateway_health():
    return {"status": "ok", "service": "gateway"}


@app.get("/health/services")
async def services_health():
    results = {}
    async with httpx.AsyncClient(timeout=3.0) as client:
        for name, url in SERVICE_ROUTES.items():
            try:
                r = await client.get(f"{url}/health")
                results[name] = "ok" if r.status_code == 200 else "degraded"
            except Exception:
                results[name] = "unreachable"
    overall = "ok" if all(v == "ok" for v in results.values()) else "degraded"
    return {"status": overall, "services": results}


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    uvicorn.run("start_api:app", host="0.0.0.0", port=GATEWAY_PORT, reload=False)
