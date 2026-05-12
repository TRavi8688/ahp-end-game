import ssl
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.logging import logger

def get_ssl_context():
    """STRICT SSL Context for Cloud SQL Isolation (Fix 1)."""
    if settings.ENVIRONMENT != "production":
        return None
    
    try:
        from app.core.secrets import get_secret
        ca_cert = get_secret("DB_CA_CERT")
        
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_REQUIRED
        
        if ca_cert:
            # We must write to a temporary file because ssl.load_verify_locations expects a path
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, mode="w", suffix=".pem") as tmp:
                tmp.write(ca_cert)
                tmp_path = tmp.name
            ctx.load_verify_locations(cafile=tmp_path)
            
        return ctx
    except Exception as e:
        logger.critical(f"STRICT_DATABASE_SSL_FAILURE: {e}")
        # FAIL CLOSED: Do not allow connection if SSL verification is broken in production
        raise RuntimeError(f"Database SSL verification failed: {e}")

# --- ENGINE ORCHESTRATION (Priority 1: Isolation) ---

# 1. Primary Writer Engine (Strictly for Mutations)
writer_engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=20,
    max_overflow=10,
    pool_recycle=1800,
    connect_args={"ssl": get_ssl_context()} if "postgresql" in settings.DATABASE_URL else {}
)

# 2. Replica Reader Engine (Strictly for Queries)
# Falls back to writer if reader URL is not provided
reader_url = settings.DATABASE_READER_URL or settings.DATABASE_URL
reader_engine = create_async_engine(
    reader_url,
    pool_size=40, # Higher pool for read-heavy clinical workloads
    max_overflow=20,
    pool_recycle=1800,
    connect_args={"ssl": get_ssl_context()} if "postgresql" in reader_url else {}
)

# --- SESSION MAKERS ---
WriterSession = sessionmaker(writer_engine, class_=AsyncSession, expire_on_commit=False)
ReaderSession = sessionmaker(reader_engine, class_=AsyncSession, expire_on_commit=False)

# Backward Compatibility Alias
AsyncSessionLocal = WriterSession
engine = writer_engine

# --- DEPENDENCY INJECTION ---

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Standard DB dependency.
    In Production, this defaults to the WRITER session for atomic safety.
    """
    async with WriterSession() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    """
    LEAST-PRIVILEGE READ DEPENDENCY:
    Routes traffic to the Read Replica to offload the Primary DB.
    Use this for all GET endpoints that do not perform writes.
    """
    async with ReaderSession() as session:
        try:
            yield session
        finally:
            await session.close()

async def set_tenant_context(session: AsyncSession, tenant_id: str):
    """Sets the PostgreSQL RLS context for the current session."""
    if not tenant_id: return
    from sqlalchemy import text
    await session.execute(text(f"SET app.current_tenant = '{tenant_id}'"))
