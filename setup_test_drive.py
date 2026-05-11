import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import Base, User, Patient, Doctor, PatientDashboard
from app.core import security
import os

DATABASE_URL = "sqlite+aiosqlite:///./test.db"

async def setup():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Create Patient Test Account
        pwd = security.get_password_hash("Hospyn@123")
        
        # 1. Patient
        user_p = User(
            email="tester@hospyn.local",
            hashed_password=pwd,
            role="patient",
            first_name="Test",
            last_name="Patient"
        )
        db.add(user_p)
        await db.flush()
        
        patient = Patient(
            user_id=user_p.id,
            hospyn_id="Hospyn-TEST-DRIVE",
            phone_number="9999999999",
            language_code="en"
        )
        db.add(patient)
        await db.flush()
        
        # Add basic dashboard
        dashboard = PatientDashboard(patient_id=patient.id, data={"summary": "Welcome to your Hospyn Test Drive!"})
        db.add(dashboard)
        
        # 2. Doctor
        user_d = User(
            email="doctor@hospyn.local",
            hashed_password=pwd,
            role="doctor",
            first_name="Dr.",
            last_name="Hospyn"
        )
        db.add(user_d)
        await db.flush()
        
        doctor = Doctor(
            user_id=user_d.id,
            license_number="MOD-TEST-2026",
            license_status="verified",
            specialty="General Medicine"
        )
        db.add(doctor)
        
        await db.commit()
        print("Test Drive accounts created successfully!")

if __name__ == "__main__":
    asyncio.run(setup())
