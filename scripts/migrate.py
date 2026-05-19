import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine
from app.core.config import settings
from app.models.models import Base
from app.core.logging import logger

async def run_migrations():
    """Enterprise Migration Tool: Safely handles DB schema updates."""
    logger.info(f"MIGRATION: Initializing connection to {settings.async_database_url.split('@')[-1]}")
    
    engine = create_async_engine(settings.async_database_url)
    
    try:
        async with engine.begin() as conn:
            logger.info("MIGRATION: Executing DDL column alignments...")
            statements = [
                "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS physical_address VARCHAR(512);",
                "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;",
                "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;",
                "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS pan_card_photo_url VARCHAR(512);",
                "ALTER TABLE hospital_branches ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;",
                "ALTER TABLE hospital_branches ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;",
                "ALTER TABLE hospital_branches ADD COLUMN IF NOT EXISTS physical_address VARCHAR(512);",
                "ALTER TABLE forensic_verification_logs ADD COLUMN IF NOT EXISTS pan_otp_code VARCHAR(10);",
                "ALTER TABLE forensic_verification_logs ADD COLUMN IF NOT EXISTS pan_otp_verified BOOLEAN DEFAULT FALSE;",
                "ALTER TABLE forensic_verification_logs ADD COLUMN IF NOT EXISTS pan_card_photo_url VARCHAR(512);"
            ]
            
            from sqlalchemy import text
            for stmt in statements:
                try:
                    await conn.execute(text(stmt))
                except Exception as ddl_e:
                    logger.warning(f"MIGRATION_DDL_NOTICE: Statement ignored ({stmt}): {str(ddl_e)}")
            
            logger.info("MIGRATION: Synchronizing SQLAlchemy models to Database...")
            await conn.run_sync(Base.metadata.create_all)
            logger.info("MIGRATION: Schema sync complete.")
    except Exception as e:
        logger.error(f"MIGRATION_FAILED: {str(e)}")
        sys.exit(1)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    if os.environ.get("ENVIRONMENT") == "production":
        print("!!! PRODUCTION MIGRATION STARTING !!!")
    
    asyncio.run(run_migrations())
