import asyncio
import uuid
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_writer_engine
from app.models.models import User, Hospital, StaffProfile, RoleEnum, OrganizationTypeEnum, VerificationStatusEnum, HospitalSettings
from app.core.security import get_password_hash

async def seed_owner():
    engine = get_writer_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # Create Owner User
        owner_email = f"owner_{uuid.uuid4().hex[:6]}@hospyn.com"
        owner_password = "SecurePassword123!"
        owner = User(
            email=owner_email,
            first_name="Test",
            last_name="Owner",
            hashed_password=get_password_hash(owner_password),
            role=RoleEnum.hospital_admin,
            is_active=True
        )
        db.add(owner)
        await db.flush()

        # Create Hospital
        hospyn_id = f"HOSP-{uuid.uuid4().hex[:6].upper()}"
        hospital = Hospital(
            hospyn_id=hospyn_id,
            short_code=uuid.uuid4().hex[:6].upper(),
            name="Test Super Specialty Hospital",
            org_type=OrganizationTypeEnum.hospital,
            registration_number=f"REG-{uuid.uuid4().hex[:6]}",
            verification_status=VerificationStatusEnum.completed,
            is_approved=True,
            payment_status="paid",
            owner_id=owner.id,
            staff_count=1
        )
        db.add(hospital)
        await db.flush()

        # Create Hospital Settings
        settings = HospitalSettings(
            hospital_id=hospital.id,
            enable_pharmacy=True,
            enable_labs=True,
            enable_inpatient_beds=True,
            enable_hr=True,
            enable_billing=True,
            max_beds_configured=100
        )
        db.add(settings)
        await db.flush()

        # Create Staff Profile for Owner
        staff_profile = StaffProfile(
            user_id=owner.id,
            hospital_id=hospital.id
        )
        db.add(staff_profile)

        await db.commit()

        print("=== OWNER ACCOUNT CREATED SUCCESSFULLY ===")
        print(f"Login Email: {owner_email}")
        print(f"Password: {owner_password}")
        print(f"Hospital ID: {hospital.id}")
        print(f"Hospyn ID: {hospital.hospyn_id}")
        print("==========================================")

if __name__ == "__main__":
    asyncio.run(seed_owner())
