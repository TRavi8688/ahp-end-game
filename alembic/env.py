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

# Read DATABASE_URL from environment — never hardcoded
_database_url = os.environ.get("DATABASE_URL", "")
if not _database_url:
    print("ERROR: DATABASE_URL environment variable is not set.", file=sys.stderr)
    sys.exit(1)
if "sqlite" in _database_url.lower():
    print("ERROR: DATABASE_URL points to SQLite. Alembic requires PostgreSQL.", file=sys.stderr)
    sys.exit(1)

# asyncpg driver for async migrations
if "postgresql://" in _database_url and "+asyncpg" not in _database_url:
    _database_url = _database_url.replace("postgresql://", "postgresql+asyncpg://")

# asyncpg uses 'ssl' instead of 'sslmode'
if "+asyncpg" in _database_url:
    _database_url = _database_url.replace("sslmode=", "ssl=")

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
