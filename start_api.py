"""
Hospyn 2.0 API Gateway & Microservices Launcher.

Boots:
1. Auth Service on port 8001 (sqlite db: backend/auth-service/hospyn_auth_local.db)
2. Healthcare Core Service on port 8002 (sqlite db: backend/healthcare-core/hospyn_healthcare_local.db)
3. API Gateway on port 8000 (proxies requests to 8001 and 8002)
"""
from contextlib import asynccontextmanager
import sys
import os
import time
import subprocess
import uvicorn
import httpx
import logging
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("gateway")

# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    start_microservices()
    yield
    # Shutdown
    logger.info("Shutting down microservices...")
    await client.aclose()
    for proc in processes:
        try:
            proc.terminate()
            proc.wait(timeout=3)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass
    logger.info("Shutdown complete.")

# Gateway app
app = FastAPI(
    title="Hospyn 2.0 API Gateway (Local Dev)",
    description="Local reverse-proxy routing requests to individual microservices.",
    version="2.0.0",
    lifespan=lifespan
)

# Enable CORS at the Gateway level — env-driven in production
_gateway_origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_gateway_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
    max_age=600,
)

AUTH_SERVICE_URL = os.environ.get("AUTH_SERVICE_URL", "http://localhost:8001")
HEALTHCARE_SERVICE_URL = os.environ.get("HEALTHCARE_SERVICE_URL", "http://localhost:8002")

client = httpx.AsyncClient()

# Subprocess handles
processes = []

def start_microservices():
    if os.environ.get("DOCKER_ENV") == "true":
        logger.info("Running in Docker environment. Microservices are managed externally.")
        return

    root_dir = os.path.dirname(os.path.abspath(__file__))
    auth_dir = os.path.join(root_dir, "backend", "auth-service")
    hc_dir = os.path.join(root_dir, "backend", "healthcare-core")
    
    # Environment with proper PYTHONPATH
    env = os.environ.copy()
    env["PYTHONPATH"] = f".;.."
    env["PYTHONIOENCODING"] = "utf-8"
    
    # 1. Start Auth Service
    logger.info("Starting Auth Service on http://localhost:8001...")
    auth_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8001"],
        cwd=auth_dir,
        env=env,
        shell=True
    )
    processes.append(auth_proc)
    
    # 2. Start Healthcare Core
    logger.info("Starting Healthcare Core on http://localhost:8002...")
    hc_proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8002"],
        cwd=hc_dir,
        env=env,
        shell=True
    )
    processes.append(hc_proc)
    
    # Wait briefly for startup
    time.sleep(2)

async def proxy_request(request: Request, url: str) -> Response:
    headers = dict(request.headers)
    headers.pop("host", None)  # Let HTTPX compute host header
    
    content = await request.body()
    params = dict(request.query_params)
    
    try:
        response = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            params=params,
            content=content,
            timeout=30.0
        )
        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers)
        )
    except httpx.HTTPError as exc:
        logger.error(f"Failed to proxy request to {url}: {exc}")
        return Response(
            content=f"Gateway Routing Error: {str(exc)}",
            status_code=502
        )

# Routes
@app.api_route("/api/v1/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
async def route_all(request: Request, path: str):
    """
    Transparent API Gateway Routing.
    Maps legacy monolith frontend calls to the new microservices.
    """
    if path.startswith("auth/"):
        url = f"{AUTH_SERVICE_URL}/api/v1/{path}"
    elif path.startswith("healthcare/"):
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/{path}"
    elif path.startswith("patient/login-hospyn"):
        url = f"{AUTH_SERVICE_URL}/api/v1/auth/login"
    elif path.startswith("patient/setup-profile"):
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/patients/"
    elif path.startswith("patient/"):
        sub_path = path.replace("patient/", "")
        if sub_path == "":
            url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/patients/"
        else:
            url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/patients/{sub_path}"
    elif path.startswith("doctors/") or path.startswith("hospitals/") or path.startswith("appointments/"):
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/{path}"
    else:
        url = f"{HEALTHCARE_SERVICE_URL}/api/v1/healthcare/{path}"
        
    return await proxy_request(request, url)

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



if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    logger.info(f"Starting Gateway on http://localhost:{port}...")
    uvicorn.run("start_api:app", host="0.0.0.0", port=port, reload=False, workers=1)
