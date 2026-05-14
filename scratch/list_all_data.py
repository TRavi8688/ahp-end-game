import asyncio
from app.core.database import get_writer_engine
from sqlalchemy import text

async def list_users():
    engine = get_writer_engine()
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id, name FROM hospitals"))
        hospitals = res.fetchall()
        print("Hospitals in DB:")
        for h in hospitals:
            print(h)
            
        res = await conn.execute(text("SELECT id, email, role FROM users"))
        users = res.fetchall()
        print("Users in DB:")
        for u in users:
            print(u)
            
        res = await conn.execute(text("SELECT id, user_id, hospyn_id FROM patients"))
        patients = res.fetchall()
        print("\nPatients in DB:")
        for p in patients:
            print(p)
            
        res = await conn.execute(text("SELECT id, type, created_at FROM medical_records WHERE patient_id = '017f5db35b034abca732f45802a39efc'"))
        records = res.fetchall()
        print("\nMedical Records in DB:")
        for r in records:
            print(r)

asyncio.run(list_users())
