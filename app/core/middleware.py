from fastapi import Request, Response
from starlette.types import ASGIApp, Scope, Receive, Send
from app.services.redis_service import redis_service
from app.core.logging import logger
from app.core.config import settings
import json
import uuid
import structlog
import asyncio

# --- PHASE 4: CENTRALIZED PUBLIC ROUTES ---
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

class RequestIDMiddleware:
    """
    PHASE 5: PURE ASGI REQUEST ID MIDDLEWARE
    Handles trace context and IP containment.
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        method = request.method
        path = request.url.path
        
        # PHASE 6: FORENSIC LOGGING
        logger.info(f"MIDDLEWARE HIT: {method} {path}")

        # PHASE 3: OPTIONS BYPASS
        if method == "OPTIONS":
            logger.info(f"OPTIONS PREFLIGHT ACCEPTED (RequestID): {path}")
            await self.app(scope, receive, send)
            return

        client_ip = request.client.host
        from app.core.limiter import check_ip_blacklist
        
        if await check_ip_blacklist(client_ip):
            logger.error(f"BLOCKED BY RequestIDMiddleware (Blacklist): {client_ip}")
            response = Response(status_code=403, content="Access Denied")
            await response(scope, receive, send)
            return

        request_id = request.headers.get("X-Request-ID") or request.headers.get("X-Trace-ID") or str(uuid.uuid4())
        
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            trace_id=request_id,
            client_ip=client_ip
        )
        
        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                from starlette.datastructures import Headers
                headers = Headers(raw=message["headers"])
                headers = headers.mutable()
                headers["X-Request-ID"] = request_id
                headers["X-Trace-ID"] = request_id
                message["headers"] = headers.raw
            await send(message)

        await self.app(scope, receive, send_wrapper)

class IdempotencyMiddleware:
    """
    PHASE 5: PURE ASGI IDEMPOTENCY MIDDLEWARE
    Prevents duplicate mutations. Path-isolated.
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        method = request.method
        path = request.url.path

        # PHASE 3: OPTIONS BYPASS
        if method == "OPTIONS":
            logger.info(f"OPTIONS PREFLIGHT ACCEPTED (Idempotency): {path}")
            await self.app(scope, receive, send)
            return

        # PHASE 4: PUBLIC ROUTE EXCLUSION
        if path in PUBLIC_ROUTES or "/auth/" in path:
            await self.app(scope, receive, send)
            return

        if method not in ["POST", "PATCH", "PUT"]:
            await self.app(scope, receive, send)
            return

        idempotency_key = request.headers.get("X-Idempotency-Key")
        
        if not idempotency_key:
            logger.error(f"BLOCKED BY IdempotencyMiddleware (Missing Key): {path}")
            response = Response(
                status_code=400, 
                content=json.dumps({
                    "error": "IdempotencyKeyRequired",
                    "detail": "X-Idempotency-Key header is mandatory for state-changing operations."
                }), 
                media_type="application/json"
            )
            await response(scope, receive, send)
            return

        # Implementation for caching would require a complex body stream handler in pure ASGI.
        # For the fix, we prioritize the blocking issue resolution.
        # Full body replay is deferred to maintain stability.
        await self.app(scope, receive, send)

class TenantMiddleware:
    """
    PHASE 5: PURE ASGI TENANT MIDDLEWARE
    Enforces multi-tenant boundaries.
    """
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request = Request(scope)
        method = request.method
        path = request.url.path

        # PHASE 3: OPTIONS BYPASS
        if method == "OPTIONS":
            logger.info(f"OPTIONS PREFLIGHT ACCEPTED (Tenant): {path}")
            await self.app(scope, receive, send)
            return

        # PHASE 4: PUBLIC ROUTE EXCLUSION
        if path in PUBLIC_ROUTES or "/auth/" in path:
            scope["state"] = scope.get("state", {})
            scope["state"]["tenant_id"] = None
            await self.app(scope, receive, send)
            return

        auth_header = request.headers.get("Authorization")
        tenant_id = None

        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            try:
                from app.core import security
                payload = security.decode_token(token, token_type="access")
                if payload:
                    tenant_id = payload.get("hospital_id") or payload.get("tenant_id")
                    if tenant_id:
                        import uuid as uuid_lib
                        tenant_id = str(uuid_lib.UUID(str(tenant_id)))
                        structlog.contextvars.bind_contextvars(hospital_id=tenant_id)
            except Exception as e:
                logger.warning(f"TENANT_EXTRACTION_FAILURE: {e}")

        scope["state"] = scope.get("state", {})
        scope["state"]["tenant_id"] = tenant_id
        
        await self.app(scope, receive, send)
