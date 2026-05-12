import time
import uuid
import json
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.logging import logger
from app.core.audit import log_audit_action

class ForensicTelemetryMiddleware(BaseHTTPMiddleware):
    """
    ENTERPRISE OBSERVABILITY (SHIELD V4):
    Captures full forensic telemetry for every API transaction.
    Enforces trace correlation across clinical AI services.
    """

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # 1. Generate or Extract Trace ID
        trace_id = request.headers.get("X-Trace-ID", str(uuid.uuid4()))
        
        # 2. Extract User Context (Safe Check)
        user_id = None
        hospyn_id = None
        try:
            # We don't want to block on auth here, just peek if token exists
            auth_header = request.headers.get("Authorization")
            if auth_header and "Bearer" in auth_header:
                # Late binding for security to avoid circular imports
                from app.core.security import decode_token
                token = auth_header.split(" ")[1]
                payload = decode_token(token)
                if payload:
                    user_id = payload.get("sub")
                    hospyn_id = payload.get("hospyn_id")
        except:
            pass

        # 3. Proceed with Request
        response: Response = await call_next(request)
        
        # 4. Calculate Metrics
        process_time = time.time() - start_time
        latency_ms = int(process_time * 1000)

        # 5. Structured Forensic Log (Stdout for Cloud Run / GCP)
        telemetry_data = {
            "trace_id": trace_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "latency_ms": latency_ms,
            "user_id": user_id,
            "hospyn_id": hospyn_id,
            "ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("User-Agent")
        }

        # Severity mapping
        if response.status_code >= 500:
            logger.error(f"FORENSIC_TELEMETRY_FAILURE: {json.dumps(telemetry_data)}")
        elif response.status_code >= 400:
            logger.warning(f"FORENSIC_TELEMETRY_WARNING: {json.dumps(telemetry_data)}")
        else:
            logger.info(f"FORENSIC_TELEMETRY_SUCCESS: {json.dumps(telemetry_data)}")

        # 6. Persistent Audit (For Security-Critical Paths)
        # We only log to the persistent DB for non-GET requests or failures to save IOPS
        if request.method != "GET" or response.status_code >= 400:
            import asyncio
            asyncio.create_task(log_audit_action(
                action=f"API_{request.method}",
                user_id=uuid.UUID(user_id) if user_id else None,
                resource_type="API_ENDPOINT",
                details={
                    "path": request.url.path,
                    "status": response.status_code,
                    "latency": latency_ms,
                    "trace_id": trace_id
                },
                hospyn_id=hospyn_id,
                ip_address=request.client.host if request.client else None
            ))

        # 7. Inject Trace ID into Response Headers for Frontend Correlation
        response.headers["X-Trace-ID"] = trace_id
        response.headers["X-Process-Time"] = str(process_time)
        
        return response
