from app.models import Base
from sqlalchemy import create_engine
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def check():
    print(f"Tables in metadata: {Base.metadata.tables.keys()}")
    
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        try:
            await conn.run_sync(Base.metadata.create_all)
            print("Successfully created all tables!")
        except Exception as e:
            print(f"Failed to create tables: {e}")

if __name__ == "__main__":
    asyncio.run(check())
