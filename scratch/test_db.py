import asyncio
import sys
import os

# Add current directory to path so we can import app
sys.path.append(os.getcwd())

from app.core.database import primary_engine

async def test_connection():
    print("Testing database connection...")
    try:
        async with primary_engine.begin() as conn:
            # Try a simple select 1
            from sqlalchemy import text
            await conn.execute(text("SELECT 1"))
        print("DATABASE_CONNECTED_SUCCESSFULLY")
    except Exception as e:
        print(f"DATABASE_CONNECTION_FAILURE: {e}")

if __name__ == "__main__":
    asyncio.run(test_connection())
