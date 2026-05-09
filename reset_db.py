import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def reset_database():
    url = settings.async_database_url
    print(f"Connecting to {url}...")
    engine = create_async_engine(url, echo=True)
    
    async with engine.begin() as conn:
        print("Dropping all tables (Cascade)...")
        await conn.execute(text("DROP SCHEMA public CASCADE;"))
        await conn.execute(text("CREATE SCHEMA public;"))
        print("All tables dropped successfully.")
    
    await engine.dispose()
    print("Database reset complete. On next startup, Hospyn 2.0 will recreate all tables with INTEGER primary keys.")

if __name__ == "__main__":
    asyncio.run(reset_database())
