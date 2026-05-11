import asyncio
import os
import sys

# Add the parent directory to the path so we can import our app modules
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import SessionLocal
from app.services.auth_service import AuthService
from app.models.models import User, PatientProfile, StaffProfile
from app.core.security import get_password_hash

async def seed_demo():
    db = SessionLocal()
    try:
        print("🌱 Seeding demo accounts...")
        
        # 1. Create Demo Patient
        patient_email = "test@hospyn.com"
        existing_patient = db.query(User).filter(User.email == patient_email).first()
        if not existing_patient:
            user = User(
                email=patient_email,
                hashed_password=get_password_hash("Hospyn123!"),
                is_active=True,
                role="patient"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            profile = PatientProfile(
                user_id=user.id,
                hospyn_id="Hospyn-000000-TEST",
                first_name="Demo",
                last_name="Patient",
                phone_number="9876543210",
                gender="Male"
            )
            db.add(profile)
            db.commit()
            print(f"✅ Demo Patient Created: Hospyn-000000-TEST / Hospyn123!")
        else:
            print("ℹ️ Demo Patient already exists.")

        # 2. Create Demo Doctor
        doctor_email = "doctor@hospyn.com"
        existing_doctor = db.query(User).filter(User.email == doctor_email).first()
        if not existing_doctor:
            user = User(
                email=doctor_email,
                hashed_password=get_password_hash("Hospyn123!"),
                is_active=True,
                role="doctor"
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            profile = StaffProfile(
                user_id=user.id,
                staff_id="DOC-001",
                first_name="Dr. Sarah",
                last_name="Hospyn",
                role="doctor",
                specialty="General Medicine"
            )
            db.add(profile)
            db.commit()
            print(f"✅ Demo Doctor Created: doctor@hospyn.com / Hospyn123!")
        else:
            print("ℹ️ Demo Doctor already exists.")

    except Exception as e:
        print(f"❌ Error seeding data: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    asyncio.run(seed_demo())
