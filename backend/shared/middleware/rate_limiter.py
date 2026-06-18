"""
Redis-Based Rate Limiting Middleware for FastAPI.

Applies sliding window rate limits per client IP.
Supports per-route overrides via route_limits config.

Fails open if Redis is unavailable — logs warning but allows request.
"""

import logging
from typing import Dict, Optional, Tuple
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Redis-based rate limiting middleware.

    Args:
        app: The FastAPI/Starlette application
        default_limit: Default max requests per window (applied to all routes)
        default_window: Default window size in seconds
        route_limits: Optional dict of path prefixes to (limit, window) tuples
                      e.g., {"/api/v1/auth/login": (5, 60)}
        enabled: Set to False to disable rate limiting entirely
    """

    def __init__(
        self,
        app,
        default_limit: int = 100,
        default_window: int = 60,
        route_limits: Optional[Dict[str, Tuple[int, int]]] = None,
        enabled: bool = True,
    ):
        super().__init__(app)
        self.default_limit = default_limit
        self.default_window = default_window
        self.route_limits = route_limits or {}
        self.enabled = enabled

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP, respecting X-Forwarded-For only from trusted proxies."""
        client_host = request.client.host if request.client else "unknown"
        forwarded = request.headers.get("x-forwarded-for")

        # Only trust X-Forwarded-For if it comes from an internal loopback or private network
        is_trusted = False
        if client_host in ("127.0.0.1", "::1", "localhost", "unknown"):
            is_trusted = True
        elif (
            client_host.startswith("172.")
            or client_host.startswith("10.")
            or client_host.startswith("192.168.")
        ):
            is_trusted = True

        if forwarded and is_trusted:
            # Take the first IP (client's real IP forwarded by the gateway)
            return forwarded.split(",")[0].strip()

        return client_host

    def _get_route_limit(self, path: str) -> Tuple[int, int]:
        """Get rate limit config for the given path. Falls back to default."""
        for prefix, (limit, window) in self.route_limits.items():
            if path.startswith(prefix):
                return limit, window
        return self.default_limit, self.default_window

    async def dispatch(self, request: Request, call_next):
        if not self.enabled:
            return await call_next(request)

        # Skip rate limiting for health checks
        if request.url.path in (
            "/health",
            "/health/auth",
            "/health/healthcare",
            "/ready",
        ):
            return await call_next(request)

        client_ip = self._get_client_ip(request)
        limit, window = self._get_route_limit(request.url.path)

        # Build unique rate limit key
        rate_key = f"{request.url.path}:{client_ip}"

        try:
            from shared.redis_client import rate_limit_check

            is_allowed, remaining = await rate_limit_check(rate_key, limit, window)
        except Exception as e:
            logger.warning(f"Rate limit check error (fail-open): {e}")
            is_allowed, remaining = True, limit

        if not is_allowed:
            logger.warning(
                f"Rate limit exceeded: ip={client_ip}, path={request.url.path}"
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": "Too many requests. Please try again later.",
                    }
                },
                headers={
                    "Retry-After": str(window),
                    "X-RateLimit-Limit": str(limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)

        # Add rate limit headers to successful responses
        response.headers["X-RateLimit-Limit"] = str(limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)

        return response
