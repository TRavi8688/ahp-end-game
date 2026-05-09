from prometheus_client import Counter, Histogram, Gauge
import time
from functools import wraps
from fastapi import Request

# Google-Grade SLIs (Service Level Indicators)
HTTP_REQUESTS_TOTAL = Counter(
    "http_requests_total", 
    "Total number of HTTP requests.",
    ["method", "endpoint", "status"]
)

HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "http_request_duration_seconds",
    "Latency of HTTP requests in seconds.",
    ["method", "endpoint"]
)

ACTIVE_SESSIONS = Gauge(
    "active_sessions",
    "Number of active user sessions."
)

CIRCUIT_BREAKER_STATE = Gauge(
    "circuit_breaker_state",
    "Current state of circuit breakers (0=Closed, 1=Open, 2=Half-Open)",
    ["provider"]
)

# --- DB POOL TELEMETRY ---
DB_POOL_SIZE = Gauge("db_pool_size", "Total configured pool size.")
DB_POOL_CHECKED_OUT = Gauge("db_pool_checked_out", "Number of active connections checked out.")
DB_POOL_OVERFLOW = Gauge("db_pool_overflow", "Number of connections in overflow.")

def update_db_metrics():
    """Syncs SQLAlchemy pool state with Prometheus gauges."""
    from app.core.database import primary_engine
    if primary_engine:
        pool = primary_engine.pool
        # Note: Accessing sync pool status on async engine is safe for metrics
        # StaticPool (used in SQLite :memory: testing) doesn't have size/checkedout/overflow
        if hasattr(pool, "size"):
            DB_POOL_SIZE.set(pool.size())
        if hasattr(pool, "checkedout"):
            DB_POOL_CHECKED_OUT.set(pool.checkedout())
        if hasattr(pool, "overflow"):
            DB_POOL_OVERFLOW.set(pool.overflow())

def instrument_request():
    """Middleware-style instrumentation for SLIs."""
    async def middleware(request: Request, call_next):
        start_time = time.time()
        
        # Route resolution for labeling
        endpoint = request.url.path
        method = request.method
        
        # Update pool metrics on every request for high-resolution monitoring
        update_db_metrics()
        
        response = await call_next(request)
        
        duration = time.time() - start_time
        status = response.status_code
        
        HTTP_REQUESTS_TOTAL.labels(method=method, endpoint=endpoint, status=status).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(method=method, endpoint=endpoint).observe(duration)
        
        return response
    
    return middleware
