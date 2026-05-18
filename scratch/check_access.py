import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select

# Add parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import DoctorAccess, Patient, User

async def main():
    db_url = "postgresql+asyncpg://neondb_owner:npg_NGAdvihT37kP@ep-falling-shape-ap8b4cm1-pooler.c-7.us-east-1.aws.neon.tech/neondb"
    engine = create_async_engine(db_url)
    async with AsyncSession(engine) as session:
        print("Querying doctor_access records...")
        stmt = select(DoctorAccess).order_by(DoctorAccess.created_at.desc()).limit(5)
        res = await session.execute(stmt)
        records = res.scalars().all()
        for r in records:
            print(f"- ID: {r.id}, Patient ID: {r.patient_id}, Doctor ID: {r.doctor_user_id}, Status: {r.status}, Created At: {r.created_at}")

asyncio.run(main())
