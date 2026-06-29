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
    
    inspector = inspect(connection)
    tables = inspector.get_table_names()
    
    if "users" in tables and "alembic_version_auth" not in tables:
        connection.execute(sa.text(
            "CREATE TABLE alembic_version_auth (version_num VARCHAR(32) NOT NULL, PRIMARY KEY (version_num))"
        ))
        connection.execute(sa.text(
            "INSERT INTO alembic_version_auth (version_num) VALUES ('004_make_email_nullable')"
        ))

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
    async with connectable.begin() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode -- connects to the database."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
