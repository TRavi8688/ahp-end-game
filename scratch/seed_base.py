import asyncio
import uuid
from app.core.database import AsyncSessionLocal
from app.models import models
from app.core import security

async def seed_base():
    db = AsyncSessionLocal()
    try:
        # 1. Create Hospital
        hospital_id = uuid.UUID('f0f0f0f0-f0f0-4040-b0b0-a0a0a0a0a0a0')
        hospital = models.Hospital(
            id=hospital_id,
            name="Hospyn Forensic Center",
            hospyn_id="HOSP-999",
            short_code="HFC",
            registration_number="REG-999"
        )
        db.add(hospital)
        
        # 2. Create User
        user_id = uuid.UUID('0b708c6b-64df-493c-9fb6-ea307132a117')
        user = models.User(
            id=user_id,
            email="8688533605",
            first_name="Hospyn",
            last_name="Forensic",
            hashed_password=security.get_password_hash("password123"),
            role=models.RoleEnum.patient,
            is_active=True
        )
        db.add(user)
        
        # 3. Create Patient
        patient_id = uuid.UUID('017f5db3-5b03-4abc-a732-f45802a39efc')
        patient = models.Patient(
            id=patient_id,
            user_id=user_id,
            hospyn_id="Hospyn-533605",
            phone_number="8688533605",
            hospital_id=hospital_id
        )
        db.add(patient)
        
        await db.commit()
        print("Base data seeded.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(seed_base())
