import asyncio
import sys
import os

# Ensure the app directory is in the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import engine
from app.models.models import Base
from app.core.logging import logger

async def init_db():
    """Initializes the production database schema."""
    logger.info("Initializing database tables...")
    try:
        async with engine.begin() as conn:
            # This will create all tables defined in models.py if they don't exist
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database initialization successful.")
        print("Database tables created successfully.")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(init_db())
