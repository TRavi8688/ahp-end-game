"""
correlation_middleware.py — Injects X-Request-ID into every request/response.
Phase 12 Fix: wires nginx's X-Request-ID into structlog context so all log lines
for a single request share the same correlation_id field.

Place at: backend/app/middleware/correlation_middleware.py
Add to main.py: app.add_middleware(CorrelationIDMiddleware)
"""
import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.app.core.logging_config import correlation_id_var, get_logger

logger = get_logger(__name__)


class CorrelationIDMiddleware(BaseHTTPMiddleware):
    """
    Reads X-Request-ID from nginx (or generates one) and:
    1. Sets it in the ContextVar so structlog picks it up automatically
    2. Adds it to the response headers for client-side tracing
    3. Binds it to structlog context for the duration of the request
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        # Prefer nginx-set X-Request-ID; fall back to generating one
        correlation_id = (
            request.headers.get("X-Request-ID")
            or request.headers.get("X-Correlation-ID")
            or str(uuid.uuid4())
        )

        # Set in ContextVar (thread-local equivalent for asyncio)
        token = correlation_id_var.set(correlation_id)

        # Also bind to structlog's context for this request
        import structlog
        structlog.contextvars.bind_contextvars(
            correlation_id=correlation_id,
            method=request.method,
            path=request.url.path,
        )

        try:
            response = await call_next(request)
        except Exception as exc:
            logger.error(
                "unhandled_exception",
                error=str(exc),
                error_type=type(exc).__name__,
            )
            raise
        finally:
            # Clear bound vars after request completes
            structlog.contextvars.clear_contextvars()
            correlation_id_var.reset(token)

        # Echo correlation ID in response so clients can trace their request
        response.headers["X-Request-ID"] = correlation_id
        return response
