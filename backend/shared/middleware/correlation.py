import uuid
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import structlog


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    """
    Middleware to inject an X-Request-ID into the structured logging context.
    If the gateway (Nginx) provides one, it uses it. Otherwise, it generates one.
    """

    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

        # Bind the request ID to the structlog context for the current request
        structlog.contextvars.bind_contextvars(request_id=request_id)

        response = await call_next(request)

        # Ensure the response carries the ID back to the client/gateway
        response.headers["X-Request-ID"] = request_id

        # Clear context variables after the request completes to prevent leakage
        structlog.contextvars.clear_contextvars()

        return response
