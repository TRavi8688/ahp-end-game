import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

engine = create_async_engine('postgresql+asyncpg://neondb_owner:npg_NGAdvihT37kP@ep-falling-shape-ap8b4cm1-pooler.c-7.us-east-1.aws.neon.tech/neondb')

async def run():
    async with engine.begin() as conn:
        # Get doctor user ID
        res = await conn.execute(text("SELECT id, email FROM users WHERE email='owner_682b82@hospyn.com'"))
        doc_user = res.fetchone()
        print("DOCTOR USER:", doc_user)
        if doc_user:
            res_acc = await conn.execute(text(f"SELECT id, patient_id, status FROM doctor_access WHERE doctor_user_id='{doc_user[0]}'"))
            print("DOCTOR ACCESS:", res_acc.fetchall())

if __name__ == "__main__":
    asyncio.run(run())
