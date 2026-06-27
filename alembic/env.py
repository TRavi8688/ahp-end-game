"""
alembic/env.py
Phase 6 fix: reads DATABASE_URL from environment variable.
Blocks SQLite. Uses asyncpg for async migrations.
"""
import asyncio
import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import pool
from sqlalchemy.ext.asyncio import async_engine_from_config

# Import all models so Alembic can detect schema changes
# Add each service's Base here as they are built
try:
    from backend.auth_service.app.core.database import Base as AuthBase
    target_metadata = AuthBase.metadata
except ImportError:
    target_metadata = None

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from urllib.parse import urlparse, parse_qsl, urlencode, urlunparse

# Read DATABASE_URL from environment — never hardcoded
_database_url = os.environ.get("DATABASE_URL", "")
if not _database_url:
    print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
    sys.exit(1)
if "sqlite" in _database_url.lower():
    print("ERROR: DATABASE_URL points to SQLite. Alembic requires PostgreSQL.", file=sys.stderr)
    sys.exit(1)

# Ensure postgresql+asyncpg
if _database_url.startswith("postgres://"):
    _database_url = _database_url.replace("postgres://", "postgresql://", 1)
if _database_url.startswith("postgresql://") and "+asyncpg" not in _database_url:
    _database_url = _database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Sanitize query parameters for asyncpg
try:
    parsed = urlparse(_database_url)
    q_params = dict(parse_qsl(parsed.query))
    q_params.pop("channel_binding", None)
    # Extract any ssl or sslmode value
    ssl_val = q_params.pop("ssl", None) or q_params.pop("sslmode", None)
    is_asyncpg = "+asyncpg" in parsed.scheme or "postgresql+asyncpg" in _database_url
    if ssl_val:
        ssl_val = str(ssl_val).lower().strip()
        if ssl_val in ("disable", "false", "no", "0"):
            target_val = "disable"
        else:
            target_val = "require"
    else:
        target_val = "disable"

    if is_asyncpg:
        q_params["ssl"] = target_val
    else:
        q_params["sslmode"] = target_val
    new_query = urlencode(q_params)
    parsed = parsed._replace(query=new_query)
    _database_url = urlunparse(parsed)
except Exception as e:
    print(f"Warning: Failed to parse DATABASE_URL query parameters: {e}", file=sys.stderr)

config.set_main_option("sqlalchemy.url", _database_url)


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
