import asyncio
import os
import sys

# Add the parent directory to the path so we can import our app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import get_writer_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Patient, Hospital, Doctor, StaffProfile
from app.core.security import get_password_hash
from sqlalchemy import select

async def seed_demo():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    try:
        print("[SEED] Seeding demo accounts...")
        
        # 0. Create Demo Hospital
        hosp_result = await db.execute(select(Hospital).where(Hospital.short_code == "HOSP1"))
        hospital = hosp_result.scalars().first()
        if not hospital:
            hospital = Hospital(
                hospyn_id="HOSP-GLOBAL-001",
                short_code="HOSP1",
                name="Hospyn Global Hospital",
                registration_number="REG-12345"
            )
            db.add(hospital)
            await db.flush()
            print("[SEED] Demo Hospital Created.")

        # 1. Create Demo Patient
        patient_email = "test@hospyn.com"
        result = await db.execute(select(User).where(User.email == patient_email))
        existing_patient = result.scalars().first()
        if not existing_patient:
            user = User(
                email=patient_email,
                hashed_password=get_password_hash("Hospyn123!"),
                is_active=True,
                role="patient",
                first_name="Rahul",
                last_name="Sharma"
            )
            db.add(user)
            await db.flush()
            
            profile = Patient(
                user_id=user.id,
                hospyn_id="HOSPYN-000000-TEST",
                phone_number="9876543210",
                gender="Male"
            )
            db.add(profile)
            await db.commit()
            print(f"[SEED] Demo Patient Created: Hospyn-000000-TEST / Hospyn123!")
        else:
            print("[SEED] Demo Patient already exists.")

        # 2. Create Demo Doctor
        doctor_email = "doctor@hospyn.com"
        result_d = await db.execute(select(User).where(User.email == doctor_email))
        existing_doctor = result_d.scalars().first()
        if not existing_doctor:
            user = User(
                email=doctor_email,
                hashed_password=get_password_hash("Hospyn123!"),
                is_active=True,
                role="doctor",
                first_name="Mulajna",
                last_name="Surgeon"
            )
            db.add(user)
            await db.flush()
            
            staff_profile = StaffProfile(
                user_id=user.id,
                hospital_id=hospital.id
            )
            db.add(staff_profile)
            
            doctor_profile = Doctor(
                user_id=user.id,
                specialty="Cardiovascular Surgery",
                license_number="LIC-SURGEON-8888",
                license_status="verified"
            )
            db.add(doctor_profile)
            
            await db.commit()
            print(f"[SEED] Demo Doctor Created: doctor@hospyn.com / Hospyn123!")
        else:
            print("[SEED] Demo Doctor already exists.")

    except Exception as e:
        print(f"[ERROR] Error seeding data: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(seed_demo())
