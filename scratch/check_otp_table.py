import asyncio
import uuid
from sqlalchemy import text
from app.core.database import get_writer_engine

async def check():
    engine = get_writer_engine()
    async with engine.connect() as conn:
        try:
            res = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='otp_verifications'"))
            table = res.scalar()
            print(f"Table exists: {table}")
            
            if table:
                res = await conn.execute(text("PRAGMA table_info(otp_verifications)"))
                cols = res.fetchall()
                print("Columns:")
                for c in cols:
                    print(c)
        except Exception as e:
            print(f"Error: {e}")

asyncio.run(check())
