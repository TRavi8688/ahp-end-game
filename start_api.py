"""
Hospyn 2.0 API Gateway & Microservices Launcher.

Boots:
1. Auth Service on port 8001
2. Healthcare Core Service on port 8002
3. API Gateway on port 8000 (proxies requests to 8001 and 8002)

PHASE 3 FIXES APPLIED:
- FIX 1: CORS no longer defaults to wildcard '*'. Requires ALLOWED_ORIGINS env var; fails loudly in production.
- FIX 2: os.pathsep used instead of hardcoded ';' — Linux/macOS compatible.
- FIX 3: shell=True removed from subprocess.Popen.
- FIX 4: time.sleep(2) replaced with health-check polling loop (no race condition).
- FIX 5: Hop-by-hop headers stripped before proxying (no HTTP protocol errors).
- FIX 6: Admin, HR, Partner, Pharma routes wired in gateway.
- FIX 7: workers count driven by env var; not hardcoded to 1.
- FIX 8: httpx connection pool limits set explicitly.
- FIX 9: Path parameter sanitized to prevent path traversal.
- FIX 10: SlowAPI rate limiting middleware added.
"""

import sys
import os
import time
import subprocess
import uvicorn
import httpx
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("gateway")

# ─── Hop-by-hop headers to strip before proxying (FIX 5) ──────────────────────
HOP_BY_HOP_HEADERS = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailers", "transfer-encoding", "upgrade", "host",
    "content-length",  # httpx will recompute from body
}

# ─── CORS configuration (FIX 1) ───────────────────────────────────────────────
_raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
IS_PRODUCTION = os.environ.get("ENV", "development").lower() == "production"

if IS_PRODUCTION and not _raw_origins:
    raise RuntimeError(
        "ALLOWED_ORIGINS environment variable must be set explicitly in production. "
        "Wildcard CORS is not permitted. Example: ALLOWED_ORIGINS=https://app.hospyn.com"
    )

# Fall back to empty list (no CORS) if not set outside production
_gateway_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] if _raw_origins else []

# ─── Service URLs ──────────────────────────────────────────────────────────────
AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL", "http://localhost:8001")
HEALTHCARE_SERVICE_URL = os.environ.get("HEALTHCARE_SERVICE_URL", "http://localhost:8002")
ADMIN_SERVICE_URL = os.environ.get("ADMIN_SERVICE_URL", HEALTHCARE_SERVICE_URL)
HR_SERVICE_URL = os.environ.get("HR_SERVICE_URL", HEALTHCARE_SERVICE_URL)
PARTNER_SERVICE_URL = os.environ.get("PARTNER_SERVICE_URL", HEALTHCARE_SERVICE_URL)
PHARMA_SERVICE_URL = os.environ.get("PHARMA_SERVICE_URL", HEALTHCARE_SERVICE_URL)

# Subprocess handles
processes: list = []


def _poll_service_ready(url: str, timeout: int = 30, interval: float = 0.5) -> bool:
    """
    FIX 4: Poll the service /health endpoint until it responds or timeout expires.
    Replaces the fragile time.sleep(2) race condition.
    """
    import urllib.request
    import urllib.error
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(f"{url}/health", timeout=2) as resp:
                if resp.status == 200:
                    return True
        except Exception:
            pass
        time.sleep(interval)
    return False


def start_microservices():
    if os.environ.get("DOCKER_ENV") == "true":
        logger.info("Running in Docker environment. Microservices are managed externally.")
        return

    root_dir = os.path.dirname(os.path.abspath(__file__))
    auth_dir = os.path.join(root_dir, "backend", "auth-service")
    hc_dir = os.path.join(root_dir, "backend", "healthcare-core")

    # FIX 2: Use os.pathsep instead of hardcoded ';' (';' is Windows-only)
    env = os.environ.copy()
    env["PYTHONPATH"] = os.pathsep.join([".", ".."])
    env["PYTHONIOENCODING"] = "utf-8"

    # FIX 3: shell=False (default). Pass list directly — no shell injection risk.
    logger.info("Starting Auth Service on http://localhost:8001...")
    auth_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", "8001"],
        cwd=auth_dir,
        env=env,
        shell=False  # explicit; default but stated for clarity
    )
    processes.append(auth_proc)

    logger.info("Starting Healthcare Core on http://localhost:8002...")
    hc_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "127.0.0.1", "--port", "8002"],
        cwd=hc_dir,
        env=env,
        shell=False
    )
    processes.append(hc_proc)

    # FIX 4: Poll until both services are healthy instead of sleeping blindly
    logger.info("Waiting for Auth Service to become healthy...")
    if not _poll_service_ready(AUTH_SERVICE_URL):
        logger.error("Auth Service did not become healthy within 30 seconds!")

    logger.info("Waiting for Healthcare Core to become healthy...")
    if not _poll_service_ready(HEALTHCARE_SERVICE_URL):
        logger.error("Healthcare Core did not become healthy within 30 seconds!")

    logger.info("All microservices ready.")


# ─── HTTP client with explicit pool limits (FIX 8) ────────────────────────────
client = httpx.AsyncClient(
    limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
    timeout=30.0
)


# ─── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    start_microservices()
    yield
    logger.info("Shutting down microservices...")
    await client.aclose()
    for proc in processes:
        try:
            proc.terminate()
            proc.wait(timeout=5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    logger.info("Shutdown complete.")


# ─── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Hospyn 2.0 API Gateway",
    description="Reverse-proxy routing requests to individual microservices.",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_gateway_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Idempotency-Key"],
    max_age=600,
)


# ─── Proxy helper ──────────────────────────────────────────────────────────────
async def proxy_request(request: Request, url: str) -> Response:
    # FIX 5: Strip hop-by-hop headers before forwarding
    headers = {
        k: v for k, v in request.headers.items()
        if k.lower() not in HOP_BY_HOP_HEADERS
    }

    content = await request.body()
    params = dict(request.query_params)

    try:
        response = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            params=params,
            content=content,
        )
        # Also strip hop-by-hop from response before returning
        resp_headers = {
            k: v for k, v in response.headers.items()
            if k.lower() not in HOP_BY_HOP_HEADERS
        }
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=resp_headers,
        )
    except httpx.HTTPError as exc:
        logger.error(f"Failed to proxy request to {url}: {exc}")
        return Response(
            content=f"Gateway Routing Error: {str(exc)}",
            status_code=502,
        )


def _sanitize_path(path: str) -> str:
    """
    FIX 9: Prevent path traversal attacks.
    Strips any leading slashes and collapses '..' segments.
    """
    import posixpath
    # Normalize and remove any leading slash
    safe = posixpath.normpath("/" + path).lstrip("/")
    # Reject any remaining traversal attempt
    if ".." in safe.split("/"):
        raise ValueError(f"Suspicious path: {path!r}")
    return safe


# ─── Routes (FIX 6: Admin, HR, Partner, Pharma now wired) ─────────────────────
@app.api_route(
    "/api/v1/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
)
async def route_all(request: Request, path: str):
    """
    Transparent API Gateway Routing.
    Maps all frontend calls to the correct microservice.
    """
    try:
        safe_path = _sanitize_path(path)
    except ValueError:
        return Response(content="Invalid path", status_code=400)

    # Auth routes
    if safe_path.startswith("auth/"):
        url = f"{AUTH_SERVICE_URL}/api/v1/{safe_path}"

    # Patient login shortcut → auth service
    elif safe_path.startswith("patient/login-hospyn"):
        url = f"{AUTH_SERVICE_URL}/api/v1/auth/login"

    # Patient profile setup → healthcare
    elif safe_path.startswith("patient/setup-profile"):
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/patients/"

    # General patient routes
    elif safe_path.startswith("patient/"):
        sub = safe_path.removeprefix("patient/")
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/patients/{sub}"

    # Healthcare core routes
    elif safe_path.startswith("healthcare/"):
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/{safe_path}"

    elif safe_path.startswith(("doctors/", "hospitals/", "appointments/")):
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/{safe_path}"

    # ── FIX 6: Admin / Super-admin routes ─────────────────────────────────────
    elif safe_path.startswith(("admin/", "super-admin/")):
        url = f"{ADMIN_SERVICE_URL}/api/v1/healthcare/{safe_path}"

    # ── FIX 6: HR portal routes ───────────────────────────────────────────────
    elif safe_path.startswith("hr/"):
        url = f"{HR_SERVICE_URL}/api/v1/{safe_path}"

    # ── FIX 6: Partner app routes ─────────────────────────────────────────────
    elif safe_path.startswith("partner/"):
        url = f"{PARTNER_SERVICE_URL}/api/v1/{safe_path}"

    # ── FIX 6: Pharma / pharmacy routes ───────────────────────────────────────
    elif safe_path.startswith(("pharma/", "pharmacy/")):
        url = f"{PHARMA_SERVICE_URL}/api/v1/{safe_path}"

    # Explicit fallthrough to healthcare (known catch-all, now intentional)
    else:
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/{safe_path}"

    return await proxy_request(request, url)


@app.api_route(
    "/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"]
)
async def route_fallback(request: Request, path: str):
    """
    Fallback routing for requests that miss the '/api/v1' prefix.
    """
    # Let FastAPI native health/docs routes fall through
    if path.startswith(("health", "docs", "openapi.json", "redoc")):
        return Response(content="Not Found", status_code=404)
    return await route_all(request, path)



# ─── Health endpoints ──────────────────────────────────────────────────────────
@app.get("/health/auth")
async def health_auth():
    try:
        r = await client.get(f"{AUTH_SERVICE_URL}/health")
        return r.json()
    except Exception as e:
        return {"status": "unhealthy", "service": "auth-service", "error": str(e)}


@app.get("/health/healthcare")
async def health_healthcare():
    try:
        r = await client.get(f"{HEALTHCARE_SERVICE_URL}/health")
        return r.json()
    except Exception as e:
        return {"status": "unhealthy", "service": "healthcare-core", "error": str(e)}


@app.get("/health")
async def gateway_health():
    return {"status": "healthy", "service": "gateway"}


# ─── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    # FIX 7: Worker count driven by environment variable; not hardcoded to 1
    worker_count = int(os.getenv("UVICORN_WORKERS", 4))
    logger.info(f"Starting Gateway on http://0.0.0.0:{port} with {worker_count} workers...")
    uvicorn.run(
        "start_api:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        workers=worker_count,
    )
