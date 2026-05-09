"""Seed script to create login credentials for both Patient and Doctor apps."""
import asyncio
from app.core.database import primary_engine, AsyncSessionLocal
from app.models.models import Base, User, Patient, Doctor
from app.core.security import get_password_hash

async def seed():
    # 1. Create all tables
    async with primary_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created.")

    async with AsyncSessionLocal() as db:
        # --- PATIENT: hospyn-1234-1234 / ravi1234 ---
        from sqlalchemy import select
        
        res = await db.execute(select(User).where(User.email == "hospyn-1234-1234@patient.local"))
        existing = res.scalars().first()
        if not existing:
            patient_user = User(
                email="hospyn-1234-1234@patient.local",
                hashed_password=get_password_hash("ravi1234"),
                first_name="Ravi",
                last_name="Patient",
                role="patient",
                is_active=True
            )
            db.add(patient_user)
            await db.flush()

            patient = Patient(
                user_id=patient_user.id,
                hospyn_id="Hospyn-1234-1234",
                phone_number="+919999999999",
                date_of_birth="1995-01-01",
                gender="Male",
                blood_group="O+",
                language_code="en"
            )
            db.add(patient)
            await db.commit()
            print("Patient created: Hospyn-1234-1234 / ravi1234")
        else:
            print("Patient already exists.")

        # --- DOCTOR: ravi@mbs / ravi1234 ---
        res2 = await db.execute(select(User).where(User.email == "ravi@mbs"))
        existing2 = res2.scalars().first()
        if not existing2:
            doctor_user = User(
                email="ravi@mbs",
                hashed_password=get_password_hash("ravi1234"),
                first_name="Ravi",
                last_name="MBS",
                role="doctor",
                is_active=True
            )
            db.add(doctor_user)
            await db.flush()

            doctor = Doctor(
                user_id=doctor_user.id,
                specialty="General Medicine",
                license_number="MBS-DOC-001",
                license_status="verified"
            )
            db.add(doctor)
            await db.commit()
            print("Doctor created: ravi@mbs / ravi1234")
        else:
            print("Doctor already exists.")

    print("\nDone! You can now login with:")
    print("  Patient App -> Hospyn ID: Hospyn-1234-1234  |  Password: ravi1234")
    print("  Doctor App  -> Email: ravi@mbs         |  Password: ravi1234")

if __name__ == "__main__":
    asyncio.run(seed())
