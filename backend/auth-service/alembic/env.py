"""
Alembic Environment Configuration for Auth Service.

Uses the async engine from the app's database module.
Reads DATABASE_URL from the app's settings (which reads from environment).
"""

import asyncio
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Import the Base and all models so metadata is populated
from shared.database.core import Base
from app.models.user import User, OTPVerification, PasswordResetToken  # noqa: F401
from app.config.settings import settings

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url with the real DATABASE_URL from environment
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode -- generates SQL script."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        version_table="alembic_version_auth",
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    import sqlalchemy as sa
    from sqlalchemy import inspect
    import logging
    
    db_logger = logging.getLogger("alembic.env")
    
    inspector = inspect(connection)
    tables = inspector.get_table_names()
    schemas = inspector.get_schema_names()
    
    db_logger.info(f"=== DB INSPECTION BEFORE RUN ===")
    db_logger.info(f"Default schema: {connection.dialect.default_schema_name}")
    db_logger.info(f"All schemas: {schemas}")
    db_logger.info(f"Tables: {tables}")
    
    # If the tracking table exists but 'users' table is missing, the database is in an inconsistent state.
    # We drop the tracking table so Alembic will re-run the migrations stack and recreate all missing tables safely.
    if "users" not in tables and "alembic_version_auth" in tables:
        db_logger.info("Inconsistent DB state detected: users table missing but alembic_version_auth exists. Wiping version table...")
        connection.execute(sa.text("DROP TABLE IF EXISTS alembic_version_auth"))
        connection.commit()
        # Re-inspect tables after dropping
        tables = [t for t in tables if t != "alembic_version_auth"]
    
    if "users" in tables and "alembic_version_auth" not in tables:
        db_logger.info("First-time setup conversion: users table exists but no alembic_version_auth. Creating version table at 004...")
        connection.execute(sa.text(
            "CREATE TABLE alembic_version_auth (version_num VARCHAR(32) NOT NULL, PRIMARY KEY (version_num))"
        ))
        connection.execute(sa.text(
            "INSERT INTO alembic_version_auth (version_num) VALUES ('004_make_email_nullable')"
        ))
        connection.commit()

    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table="alembic_version_auth",
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations using async engine."""
    connectable = async_engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode -- connects to the database."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
