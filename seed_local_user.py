import asyncio
import sys
import os
import uuid
from datetime import datetime, timezone, timedelta

# Add current directory to sys.path
sys.path.append(os.getcwd())

from app.core.database import get_writer_engine
from app.models.models import User, Patient, Hospital, OTPVerification
from app.core import security
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

async def seed_user():
    print(">>> HOSPYN_LOCAL_SEED_START")
    engine = get_writer_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # 1. Define Identifiers
        phone = "8688533605"
        user_id = uuid.UUID("0b708c6b-64df-493c-9fb6-ea307132a117")
        hospital_id = uuid.UUID("f0f0f0f0-f0f0-4040-b0b0-a0a0a0a0a0a0")
        
        # SYNC WITH FRONTEND: OnboardingScreen.js uses 'DefaultPass123!'
        frontend_password = "DefaultPass123!"

        # 2. Create dummy Hospital (Tenant)
        from sqlalchemy import select
        res_h = await session.execute(select(Hospital).where(Hospital.id == hospital_id))
        hospital = res_h.scalars().first()
        
        if not hospital:
            hospital = Hospital(
                id=hospital_id,
                hospyn_id="HOSPYN-CENTRAL",
                short_code="HC001",
                name="Hospyn Forensic Center",
                registration_number="REG-123456"
            )
            session.add(hospital)
            print(">>> HOSPYN_LOCAL_SEED: Created Central Hospital")

        # 3. Create User
        res_u = await session.execute(select(User).where(User.id == user_id))
        user = res_u.scalars().first()
        
        if not user:
            user = User(
                id=user_id,
                email=phone, 
                first_name="Test",
                last_name="User",
                hashed_password=security.get_password_hash(frontend_password),
                role="patient",
                is_active=True,
                token_version=1
            )
            session.add(user)
            print(">>> HOSPYN_LOCAL_SEED: Created Test User with synced password")
        else:
            # Update password if user exists
            user.hashed_password = security.get_password_hash(frontend_password)
            print(">>> HOSPYN_LOCAL_SEED: Updated existing user password")

        # 4. Create Patient
        res_p = await session.execute(select(Patient).where(Patient.user_id == user_id))
        patient = res_p.scalars().first()
        
        if not patient:
            patient = Patient(
                id=uuid.uuid4(),
                user_id=user.id,
                phone_number=phone,
                hospyn_id="Hospyn-533605",
                hospital_id=hospital_id
            )
            session.add(patient)
            print(f">>> HOSPYN_LOCAL_SEED: Created Patient for {phone}")

        # 5. Seed Magic OTP
        # Delete old OTPs first
        from sqlalchemy import delete
        await session.execute(delete(OTPVerification).where(OTPVerification.identifier == phone))
        
        otp_record = OTPVerification(
            identifier=phone,
            otp="868853",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
            is_verified=False
        )
        session.add(otp_record)
        print(">>> HOSPYN_LOCAL_SEED: Seeded Magic OTP 868853")

        await session.commit()
        print(">>> HOSPYN_LOCAL_SEED_SUCCESS")

if __name__ == "__main__":
    asyncio.run(seed_user())
