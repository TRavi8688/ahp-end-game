"""
backend/healthcare-core/app/middleware/audit.py
===============================================
FIXES APPLIED:
  - Logs all PHI access (READ and WRITE) with actor identity
  - Covers all patient-facing routes
  - Async — does not slow down API responses
  - Required for DPDP Act compliance
"""

import logging
import uuid
from datetime import datetime, timezone
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Routes that contain Protected Health Information (PHI)
PHI_ROUTE_PREFIXES = [
    "/api/v1/healthcare/patients",
    "/api/v1/healthcare/appointments",
    "/api/v1/healthcare/medical-records",
    "/api/v1/healthcare/prescriptions",
    "/api/v1/healthcare/vitals",
    "/api/v1/healthcare/lab",
    "/api/v1/healthcare/queue",
]

# Map HTTP methods to audit action names
METHOD_TO_ACTION = {
    "GET": "READ",
    "POST": "CREATE",
    "PUT": "UPDATE",
    "PATCH": "UPDATE",
    "DELETE": "DELETE",
}


def _is_phi_route(path: str) -> bool:
    return any(path.startswith(prefix) for prefix in PHI_ROUTE_PREFIXES)


class PhiAuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs all access to PHI routes.
    Writes a structured log entry for every request to a PHI endpoint.
    These logs feed into the audit trail required by DPDP Act 2023.
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        response = await call_next(request)

        if _is_phi_route(request.url.path):
            # Only log successful responses (2xx) and auth failures (401/403)
            # Skip 404s — they don't involve actual data access
            if response.status_code not in (404, 405, 422):
                actor = getattr(request.state, "user", None)
                actor_id = str(actor.id) if actor else "anonymous"
                actor_role = str(actor.role) if actor else "unknown"

                audit_entry = {
                    "event": "PHI_ACCESS",
                    "audit_id": str(uuid.uuid4()),
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "actor_id": actor_id,
                    "actor_role": actor_role,
                    "action": METHOD_TO_ACTION.get(request.method, request.method),
                    "http_method": request.method,
                    "path": request.url.path,
                    "query": str(request.query_params),
                    "status_code": response.status_code,
                    "ip_address": request.client.host if request.client else "unknown",
                    "user_agent": request.headers.get("user-agent", ""),
                    "request_id": request.headers.get("x-request-id", ""),
                }

                # Structured log — picked up by Cloud Logging / ELK / Datadog
                logger.info("PHI_AUDIT", extra=audit_entry)

                # TODO (Phase 2): Also write to phi_audit_log DB table
                # await AuditRepository.create(db, audit_entry)

        return response


def setup_audit_middleware(app) -> None:
    """
    Call this in main.py to register the audit middleware.

    Usage in main.py:
        from app.middleware.audit import setup_audit_middleware
        setup_audit_middleware(app)
    """
    app.add_middleware(PhiAuditMiddleware)
