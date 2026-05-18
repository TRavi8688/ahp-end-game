import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select

# Add parent directory to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.models import Patient, User, FamilyMember

async def main():
    db_url = "postgresql+asyncpg://neondb_owner:npg_NGAdvihT37kP@ep-falling-shape-ap8b4cm1-pooler.c-7.us-east-1.aws.neon.tech/neondb"
    engine = create_async_engine(db_url)
    async with AsyncSession(engine) as session:
        # 1. Query exact patient
        print("Querying Patient...")
        stmt = select(Patient).where(Patient.hospyn_id == "Hospyn-D0AAB75D")
        res = await session.execute(stmt)
        patient = res.scalar_one_or_none()
        print("Patient exact result:", patient)
        if patient:
            print(f"Patient ID: {patient.id}, User ID: {patient.user_id}, Hospyn ID: {patient.hospyn_id}")
            
        # 2. Query exact family member
        print("\nQuerying Family Member...")
        stmt = select(FamilyMember).where(FamilyMember.linked_hospyn_id == "Hospyn-D0AAB75D")
        res = await session.execute(stmt)
        fm = res.scalar_one_or_none()
        print("Family Member exact result:", fm)
        if fm:
            print(f"Family Member ID: {fm.id}, Patient ID: {fm.patient_id}, Linked Hospyn ID: {fm.linked_hospyn_id}")

        # 3. List all patients to see what we have
        print("\nListing first 5 patients...")
        stmt_all = select(Patient).limit(5)
        res_all = await session.execute(stmt_all)
        patients = res_all.scalars().all()
        for p in patients:
            print(f"- Hospyn ID: {p.hospyn_id}, ID: {p.id}")

asyncio.run(main())
