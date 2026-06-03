import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import text
from app.core.database import get_writer_engine

async def run():
    engine = get_writer_engine()
    async with engine.begin() as conn:
        try:
            await conn.execute(text('ALTER TABLE hospitals ADD COLUMN qr_code_id VARCHAR(100) UNIQUE;'))
            print("Successfully added qr_code_id")
        except Exception as e:
            print(f"Error (maybe already exists): {e}")

if __name__ == "__main__":
    asyncio.run(run())
