import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select

# Add parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import User, Doctor

async def main():
    db_url = "postgresql+asyncpg://neondb_owner:npg_NGAdvihT37kP@ep-falling-shape-ap8b4cm1-pooler.c-7.us-east-1.aws.neon.tech/neondb"
    engine = create_async_engine(db_url)
    async with AsyncSession(engine) as session:
        print("Querying doctors...")
        # Join User and Doctor to list active doctor accounts
        stmt = select(User).where(User.role == "doctor").limit(5)
        res = await session.execute(stmt)
        doctors = res.scalars().all()
        print("Doctors in database:")
        for d in doctors:
            print(f"- Email: {d.email}, ID: {d.id}, Name: {d.first_name} {d.last_name}")
            
        if not doctors:
            print("No doctors found! Listing first 5 users instead:")
            stmt_all = select(User).limit(5)
            res_all = await session.execute(stmt_all)
            users = res_all.scalars().all()
            for u in users:
                print(f"- Email: {u.email}, Role: {u.role}, ID: {u.id}")

asyncio.run(main())
