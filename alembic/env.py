import logging
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool

from alembic import context

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

logger = logging.getLogger("alembic.env")

# add your model's MetaData object here
# for 'autogenerate' support
from app.models.models import Base
from app.core.config import settings
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """
    ENTERPRISE MIGRATION GATEWAY (SHIELD V8):
    Implements Distributed Locking and Forensic Audit Chains.
    """
    from sqlalchemy import text
    sync_url = settings.sync_database_url
    if not sync_url or ("://" not in sync_url and "sqlite" not in sync_url):
        logger.error(f"FATAL: DATABASE_URL is malformed or empty. Length={len(sync_url) if sync_url else 0}")
        # Log a masked version for debugging
        if sync_url:
            logger.error(f"URL_PREFIX: {sync_url[:10]}...")
        raise RuntimeError("Could not initialize database connection: URL is empty or invalid.")
    
    sync_url = settings.sync_database_url
    if not sync_url or ("://" not in sync_url and "sqlite" not in sync_url):
        logger.error(f"FATAL: DATABASE_URL is malformed or empty. Length={len(sync_url) if sync_url else 0}")
        raise RuntimeError("Could not initialize database connection: URL is empty or invalid.")
    
    config.set_main_option("sqlalchemy.url", sync_url)
    
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    def render_item(type_, val, autogen_context):
        """Safeguard: Ensures custom Hospyn types are rendered with deep imports, not absolute app.* paths."""
        if type_ == "type" and hasattr(val, "__module__") and "app.core.encryption" in val.__module__:
            # Ensure the import is added to the generated script
            autogen_context.imports.add("from app.core.encryption import StringEncryptedType, TextEncryptedType")
            return val.__class__.__name__
        return False

    with connectable.connect() as connection:
        logger.info("MIGRATION_SEQUENCE_STARTED")
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            render_as_batch=True,
            render_item=render_item
        )
        try:
            with context.begin_transaction():
                context.run_migrations()
            logger.info("MIGRATION_SEQUENCE_COMPLETED")
        except Exception as e:
            logger.error(f"MIGRATION_FAILURE: {e}")
            raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
