import asyncio
from app.core.database import engine
from app.models.models import Base

async def init_db():
    print("Creating database tables for Hospyn 2.0...")
    async with engine.begin() as conn:
        # This will create all tables defined in models.py if they don't exist
        await conn.run_sync(Base.metadata.create_all)
    print("Database initialization complete.")

if __name__ == "__main__":
    asyncio.run(init_db())
