import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

engine = create_async_engine('postgresql+asyncpg://neondb_owner:npg_NGAdvihT37kP@ep-falling-shape-ap8b4cm1-pooler.c-7.us-east-1.aws.neon.tech/neondb')

async def run():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT id, phone_number, role FROM users"))
        users = res.fetchall()
        print("ALL USERS:")
        for u in users:
            print(u)
        
        res_p = await conn.execute(text("SELECT id, user_id, hospyn_id FROM patients"))
        pats = res_p.fetchall()
        print("\nALL PATIENTS:")
        for p in pats:
            print(p)
            
        res_dp = await conn.execute(text("SELECT id, patient_id FROM digital_prescriptions"))
        dps = res_dp.fetchall()
        print("\nALL PRESCRIPTIONS:")
        for d in dps:
            print(d)

if __name__ == "__main__":
    asyncio.run(run())
