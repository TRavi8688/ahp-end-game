from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.services.redis_service import redis_service
from app.core.logging import logger
from app.core.config import settings
import json
import uuid
import logging

# --- CENTRALIZED PUBLIC ROUTES ---
PUBLIC_ROUTES = {
    "/api/v1/auth/register",
    "/api/v1/auth/login",
    "/api/v1/auth/check-user",
    "/api/v1/patient/login-hospyn",
    "/health",
    "/healthz",
    "/readyz",
    "/metrics",
}

class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        request_id = request.headers.get("X-Request-ID") or request.headers.get("X-Trace-ID") or str(uuid.uuid4())
        # We use standard logging for now to ensure startup stability
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

class IdempotencyMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        path = request.url.path.lower()
        if any(x in path for x in ["/auth/", "/login", "/register", "/check-user"]):
            return await call_next(request)

        if request.method not in ["POST", "PATCH", "PUT"]:
            return await call_next(request)

        idempotency_key = request.headers.get("X-Idempotency-Key")
        if not idempotency_key:
            return Response(
                status_code=400,
                content=json.dumps({"error": "IdempotencyKeyRequired"}),
                media_type="application/json"
            )

        return await call_next(request)

class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method == "OPTIONS":
            return await call_next(request)

        auth_header = request.headers.get("Authorization")
        request.state.tenant_id = None

        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            try:
                from app.core import security
                payload = security.decode_token(token, token_type="access")
                if payload:
                    tenant_id = payload.get("hospital_id") or payload.get("tenant_id")
                    request.state.tenant_id = tenant_id
            except Exception:
                pass

        return await call_next(request)
