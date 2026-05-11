import os
import time
from fastapi import Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.exc import OperationalError
from app.core.config import settings
from app.core.logging import logger

from typing import Dict, Any, Optional

# --- ENGINE CONFIGURATION ---
def create_resilient_engine(url: str):
    if not url: return None
    is_sqlite = "sqlite" in url
    kwargs: Dict[str, Any] = {"echo": False}
    
    if not is_sqlite:
        import ssl
        # Standardize URL: asyncpg doesn't like 'sslmode' in the query string if we pass 'ssl' context
        if "?" in url and "sslmode=" in url:
            base_url = url.split("?")[0]
            query_params = url.split("?")[1].split("&")
            filtered_params = [p for p in query_params if not p.startswith("sslmode=")]
            url = base_url + ("?" + "&".join(filtered_params) if filtered_params else "")

        # Standardize SSL context for Cloud environments
        ctx = ssl.create_default_context()
        # Allow connection even if the cert is self-signed (common in cloud SQL)
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        kwargs.update({
            "pool_size": 20,
            "max_overflow": 10,
            "pool_recycle": 3600,
            "pool_timeout": 30,
            "pool_pre_ping": True,
            "connect_args": {"ssl": ctx, "command_timeout": 15}
        })
    else:
        kwargs.update({
            "connect_args": {"check_same_thread": False}
        })
    return create_async_engine(url, **kwargs)

# Initialize Primary Engine
primary_engine = create_resilient_engine(settings.async_database_url)
AsyncSessionLocal = async_sessionmaker(primary_engine, expire_on_commit=False, class_=AsyncSession)

# --- ENTERPRISE DB DEPENDENCY ---
async def set_tenant_context(session: AsyncSession, tenant_id: str):
    """
    Sets the tenant_id in the Postgres session for RLS enforcement.
    ENTERPRISE HARDENING: Uses parameterized binding to prevent RLS injection.
    """
    # Using local variable for RLS prevents cross-transaction leakage in connection pooling
    # Parameterized query is mandatory for security.
    await session.execute(
        text("SET LOCAL app.current_tenant = :tenant_id"),
        {"tenant_id": tenant_id}
    )

# --- ENTERPRISE DB DEPENDENCY ---
async def get_db(request: Request):
    """
    Standard FastAPI dependency for database sessions.
    Automatically sets the Postgres RLS tenant context if present in request.
    """
    async with AsyncSessionLocal() as session:
        if request and hasattr(request.state, "tenant_id") and request.state.tenant_id:
            await set_tenant_context(session, request.state.tenant_id)
            
        try:
            yield session
        finally:
            await session.close()
