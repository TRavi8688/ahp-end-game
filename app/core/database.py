import os
import ssl
from typing import AsyncGenerator, Optional
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.core.logging import logger

def get_ssl_context():
    """STRICT SSL Context for Cloud SQL Isolation (Shield V10)."""
    if settings.ENVIRONMENT != "production":
        return None
    
    # Check if we are using SQLite (no SSL needed)
    if "sqlite" in settings.DATABASE_URL:
        return None

    try:
        from app.core.secrets import get_secret
        ca_cert = get_secret("DB_CA_CERT")
        
        ctx = ssl.create_default_context()
        ctx.check_hostname = False # Cloud SQL hostname usually doesn't match the cert
        ctx.verify_mode = ssl.CERT_REQUIRED
        
        if ca_cert:
            # We must write to a temporary file because ssl.load_verify_locations expects a path
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, mode="w", suffix=".pem") as tmp:
                tmp.write(ca_cert)
                tmp_path = tmp.name
            ctx.load_verify_locations(cafile=tmp_path)
            logger.info("DATABASE: SSL verification ENABLED using CA Certificate from Secret Manager")
        else:
            logger.warning("DATABASE: SSL verification ENABLED but no CA Certificate found in secrets")
            
        return ctx
    except Exception as e:
        logger.critical(f"STRICT_DATABASE_SSL_FAILURE: {e}")
        # FAIL CLOSED: Do not allow connection if SSL verification is broken in production
        raise RuntimeError(f"Database SSL verification failed: {e}")

# --- ENGINE ORCHESTRATION (LAZY) ---

_writer_engine = None
_reader_engine = None

def get_writer_engine():
    global _writer_engine
    if _writer_engine is None:
        _writer_engine = create_async_engine(
            settings.async_database_url,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_recycle=1800,
            connect_args={"ssl": get_ssl_context()} if "postgresql" in settings.DATABASE_URL else {}
        )
    return _writer_engine

def get_reader_engine():
    global _reader_engine
    if _reader_engine is None:
        reader_url = settings.DATABASE_READER_URL or settings.DATABASE_URL
        if "postgres" in reader_url and "asyncpg" not in reader_url:
            reader_url = reader_url.replace("postgres://", "postgresql+asyncpg://", 1)
            reader_url = reader_url.replace("postgresql://", "postgresql+asyncpg://", 1)
            
        _reader_engine = create_async_engine(
            reader_url,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_recycle=1800,
            connect_args={"ssl": get_ssl_context()} if "postgresql" in reader_url else {}
        )
    return _reader_engine

# --- DEPENDENCIES ---
from sqlalchemy.orm import with_loader_criteria
from app.core.context import get_current_hospital_id
from app.models.mixins import TenantScopedMixin

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    engine = get_writer_engine()
    hospital_id = get_current_hospital_id()
    
    async with sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as session:
        # --- THE RESILIENCE SHIELD: IMPLICIT TENANT FILTER ---
        # Automatically filters EVERY query to only show data for the current hospital.
        if hospital_id:
            session.execute_options = {
                "loader_criteria": [
                    with_loader_criteria(
                        TenantScopedMixin, 
                        lambda cls: cls.hospital_id == hospital_id,
                        include_subclasses=True
                    )
                ]
            }
            # Also set the DB context for RLS if needed
            await set_tenant_context(session, str(hospital_id))
            
        try:
            yield session
        finally:
            await session.close()

async def get_read_db() -> AsyncGenerator[AsyncSession, None]:
    engine = get_reader_engine()
    hospital_id = get_current_hospital_id()
    
    async with sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)() as session:
        if hospital_id:
            session.execute_options = {
                "loader_criteria": [
                    with_loader_criteria(
                        TenantScopedMixin, 
                        lambda cls: cls.hospital_id == hospital_id,
                        include_subclasses=True
                    )
                ]
            }
        try:
            yield session
        finally:
            await session.close()

async def set_tenant_context(session: AsyncSession, tenant_id: str):
    """Sets the PostgreSQL RLS context for the current session."""
    if not tenant_id: return
    from sqlalchemy import text
    await session.execute(text(f"SET app.current_tenant = '{tenant_id}'"))
