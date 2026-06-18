import uuid
import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware to extract or generate a Correlation ID (Trace-ID).
    Binds the ID to structlog contextvars so it appears in all log statements
    for the duration of the request, enabling cross-service request tracing.
    """
    async def dispatch(self, request: Request, call_next):
        correlation_id = request.headers.get("X-Correlation-ID") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
        
        # Bind the trace_id so structlog automatically includes it in all logs
        structlog.contextvars.bind_contextvars(trace_id=correlation_id)
        
        try:
            response = await call_next(request)
            response.headers["X-Correlation-ID"] = correlation_id
            return response
        finally:
            structlog.contextvars.clear_contextvars()
