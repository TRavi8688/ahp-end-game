import asyncio
import uuid
from app.core.database import get_writer_engine
from sqlalchemy import text

async def check():
    engine = get_writer_engine()
    async with engine.connect() as conn:
        try:
            # Check user
            res = await conn.execute(text("SELECT id, role, token_version FROM users WHERE id = :id"), {"id": "0b708c6b-64df-493c-9fb6-ea307132a117"})
            user = res.fetchone()
            print(f"User: {user}")
            
            # Check patient profile
            res = await conn.execute(text("SELECT id, hospyn_id, phone_number FROM patients WHERE user_id = :id"), {"id": "0b708c6b-64df-493c-9fb6-ea307132a117"})
            patient = res.fetchone()
            print(f"Patient: {patient}")
        except Exception as e:
            print(f"Error: {e}")

asyncio.run(check())
