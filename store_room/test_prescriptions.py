import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.models import DigitalPrescription, Patient, User

async def main():
    engine = create_async_engine('postgresql+asyncpg://postgres:12345678@localhost:5432/hospyn')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        stmt = select(DigitalPrescription)
        res = await session.execute(stmt)
        prescriptions = res.scalars().all()
        for p in prescriptions:
            print(f"Prescription ID: {p.id}")
            print(f"Patient ID: {p.patient_id}")
            print(f"Hospital ID: {p.hospital_id}")
            print(f"Status: {p.status}")
            print(f"Diagnosis: {p.diagnosis}")
            print("---")
            
        print("Done.")

asyncio.run(main())
