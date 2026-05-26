import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import get_writer_engine

async def run():
    engine = get_writer_engine()
    cols = [
        ("email_notifications_enabled", "BOOLEAN DEFAULT TRUE"),
        ("sms_notifications_enabled", "BOOLEAN DEFAULT FALSE"),
        ("session_timeout_minutes", "INTEGER DEFAULT 15"),
        ("phone_number", "VARCHAR(50) NULL")
    ]
    for col_name, col_type in cols:
        async with engine.begin() as conn:
            try:
                await conn.execute(text(f'ALTER TABLE doctors ADD COLUMN {col_name} {col_type};'))
                print(f"Successfully added {col_name}")
            except Exception as e:
                print(f"Error adding {col_name} (maybe already exists): {e}")

if __name__ == "__main__":
    asyncio.run(run())
