from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.services.redis_service import redis_service
from app.core.logging import logger
import json
import uuid
import structlog
import asyncio

class RequestIDMiddleware(BaseHTTPMiddleware):
    """
    ENTERPRISE OBSERVABILITY & TRACING:
    1. Injects X-Request-ID and X-Trace-ID (Aliased for compatibility).
    2. Enforces IP-level containment.
    3. Binds trace context to all downstream logs.
    """
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        from app.core.limiter import check_ip_blacklist
        
        # Enforce IP Blacklist check (Fail-fast)
        if await check_ip_blacklist(client_ip):
            logger.warning("BLACKLIST_HIT", ip=client_ip)
            return Response(status_code=403, content="Access Denied")

        # Generate or Propagate Trace Context
        request_id = request.headers.get("X-Request-ID") or request.headers.get("X-Trace-ID") or str(uuid.uuid4())
        
        # Bind to structlog context (Google-grade structured observability)
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            trace_id=request_id, # Alias for distributed tracing (Zipkin/Jaeger)
            client_ip=client_ip
        )
        
        response = await call_next(request)
        
        # Propagate headers back to client
        response.headers["X-Request-ID"] = request_id
        response.headers["X-Trace-ID"] = request_id
        
        return response

class IdempotencyMiddleware(BaseHTTPMiddleware):
    """
    ENTERPRISE IDEMPOTENCY ENFORCEMENT: 
    Mandatory for all state-changing operations (POST, PUT, PATCH).
    Prevents duplicate clinical record creation and thundering herd scenarios.
    """
    async def dispatch(self, request: Request, call_next):
        # 1. Exempt non-mutating methods
        if request.method not in ["POST", "PATCH", "PUT"]:
            return await call_next(request)

        # 2. Exempt Authentication & Onboarding (Prevent 400 errors for new users)
        path = request.url.path.lower()
        if any(x in path for x in ["/auth/", "/onboarding/", "/login", "/register", "/check-user"]):
            return await call_next(request)

        idempotency_key = request.headers.get("X-Idempotency-Key")
        
        # --- STRICT ENFORCEMENT for everything else ---
        if not idempotency_key:
            logger.warning("MISSING_IDEMPOTENCY_KEY", method=request.method, path=path)
            return Response(
                status_code=400, 
                content=json.dumps({
                    "error": "IdempotencyKeyRequired",
                    "detail": "X-Idempotency-Key header is mandatory for state-changing operations."
                }), 
                media_type="application/json"
            )

        # Context-aware caching (Scoping idempotency to the authenticated user)
        # We perform a fast JWT decode (no DB lookup) to extract the 'sub' (user_id)
        user_id = "anon"
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            try:
                from jose import jwt
                from app.core.config import settings
                # Verify signature and audience to ensure we only scope to valid tokens
                payload = jwt.decode(
                    token, 
                    settings.JWT_PUBLIC_KEY, 
                    algorithms=["RS256"], 
                    audience=settings.JWT_AUDIENCE
                )
                user_id = payload.get("sub", "anon")
            except Exception:
                # If token is invalid, we fallback to anon. 
                # The actual auth dependency in the route will handle the 401 error.
                pass

        cache_key = f"idempotency:res:{user_id}:{idempotency_key}"
        lock_key = f"idempotency:lock:{user_id}:{idempotency_key}"

        try:
            # 1. Atomic Cache Lookup (Response Replay)
            cached_res = await redis_service.get(cache_key)
            if cached_res:
                logger.info("IDEMPOTENCY_HIT", key=idempotency_key)
                data = json.loads(cached_res)
                return Response(
                    content=data["body"],
                    status_code=data["status_code"],
                    headers=data["headers"],
                    media_type=data.get("media_type", "application/json")
                )

            # 2. Distributed Locking (Atomic SET NX)
            is_locked = await redis_service.set_nx(lock_key, "LOCKED", expire=30)
            if not is_locked:
                logger.warning("IDEMPOTENCY_CONCURRENT_WAIT", key=idempotency_key)
                # Adaptive Polling for the original request's result
                for _ in range(10):
                    await asyncio.sleep(0.5)
                    cached_res = await redis_service.get(cache_key)
                    if cached_res:
                        data = json.loads(cached_res)
                        return Response(content=data["body"], status_code=data["status_code"], headers=data["headers"])
                
                return Response(status_code=409, content=json.dumps({"detail": "Operation already in progress."}), media_type="application/json")

            # 3. Process Original Request
            response = await call_next(request)

            # 4. Cache Response for Replay (Success codes only)
            if 200 <= response.status_code < 300:
                response_body = b""
                async for chunk in response.body_iterator:
                    response_body += chunk
                
                # Reconstruct response for the caller
                new_response = Response(
                    content=response_body,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    media_type=response.media_type
                )

                cache_data = {
                    "body": response_body.decode('utf-8') if response.media_type == "application/json" else "",
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                    "media_type": response.media_type
                }
                
                if cache_data["body"]:
                    await redis_service.set(cache_key, json.dumps(cache_data), expire=86400) # 24h cache
                
                return new_response

            return response

        except Exception as e:
            logger.error("IDEMPOTENCY_SYSTEM_ERROR", error=str(e))
            return await call_next(request)
        finally:
            # Release lock
            await redis_service.delete(lock_key)

class TenantMiddleware(BaseHTTPMiddleware):
    """
    ENTERPRISE TENANT BOUNDARY ENFORCEMENT:
    Extracts and cryptographically verifies the tenant_id from the JWT.
    Trust is NEVER established on unverified claims to prevent RLS bypass/injection.
    """
    async def dispatch(self, request: Request, call_next):
        auth_header = request.headers.get("Authorization")
        request.state.tenant_id = None

        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.replace("Bearer ", "")
            try:
                from app.core import security
                # ENTERPRISE: Perform FULL cryptographic verification (RS256) 
                # BEFORE trusting any tenant context.
                payload = security.decode_token(token, token_type="access")
                
                if payload:
                    # Check for hospital_id or fallback to tenant_id
                    tenant_id_raw = payload.get("hospital_id") or payload.get("tenant_id")
                    
                    if tenant_id_raw:
                        # STRICT VALIDATION: Ensure it's a valid UUID to prevent SQL injection 
                        # downstream in the RLS session setup.
                        import uuid as uuid_lib
                        try:
                            valid_uuid = str(uuid_lib.UUID(str(tenant_id_raw)))
                            request.state.tenant_id = valid_uuid
                            
                            # Bind to logging context for auditability
                            structlog.contextvars.bind_contextvars(hospital_id=valid_uuid)
                        except ValueError:
                            logger.error("MALFORMED_TENANT_ID_IN_JWT", tenant_id=tenant_id_raw)
                            return Response(status_code=401, content="Invalid security context")
            except Exception as e:
                logger.warning(f"TENANT_EXTRACTION_FAILURE: {e}")

        return await call_next(request)
