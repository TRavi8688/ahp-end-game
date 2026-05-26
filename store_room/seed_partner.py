import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_writer_engine
from app.models.models import User, Hospital, StaffProfile, RoleEnum, OrganizationTypeEnum, VerificationStatusEnum, HospitalSettings
from app.models.pharmacy import PharmacyInventory
from app.core.security import get_password_hash

async def seed_partner():
    engine = get_writer_engine()
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        partner_email = "owner@apollo.com"
        partner_password = "SecurePassword123!"
        
        # Check if already exists
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == partner_email))
        partner = result.scalar_one_or_none()
        
        if not partner:
            # Create Partner User
            partner = User(
                email=partner_email,
                first_name="Apollo",
                last_name="Owner",
                hashed_password=get_password_hash(partner_password),
                role=RoleEnum.hospital_admin,
                is_active=True
            )
            db.add(partner)
            await db.flush()

        # Create Partner Hospital (Pharmacy)
        hospyn_id = f"PARTNER-{uuid.uuid4().hex[:6].upper()}"
        hospital = Hospital(
            hospyn_id=hospyn_id,
            short_code=uuid.uuid4().hex[:6].upper(),
            name="Apollo Diagnostics & Pharmacy",
            org_type=OrganizationTypeEnum.pharmacy,
            registration_number=f"REG-PH-{uuid.uuid4().hex[:6]}",
            verification_status=VerificationStatusEnum.completed,
            is_approved=True,
            payment_status="paid",
            owner_id=partner.id,
            staff_count=5
        )
        db.add(hospital)
        await db.flush()

        # Create Settings
        settings = HospitalSettings(
            hospital_id=hospital.id,
            enable_pharmacy=True,
            enable_labs=True,
            enable_inpatient_beds=False,
            enable_hr=False,
            enable_billing=True,
            max_beds_configured=0
        )
        db.add(settings)
        
        # Create Staff Profile
        staff_profile = StaffProfile(
            user_id=partner.id,
            hospital_id=hospital.id
        )
        db.add(staff_profile)
        await db.flush()

        # Seed Inventory
        medicines = [
            ("Paracetamol 500mg", "Acetaminophen", 500.0, 2.50),
            ("Amoxicillin 250mg", "Amoxicillin", 200.0, 5.00),
            ("Cetirizine 10mg", "Cetirizine", 150.0, 1.50),
            ("Ibuprofen 400mg", "Ibuprofen", 300.0, 3.00),
            ("Omeprazole 20mg", "Omeprazole", 100.0, 4.00)
        ]
        
        for name, generic, qty, price in medicines:
            inv = PharmacyInventory(
                hospital_id=hospital.id,
                item_name=name,
                generic_name=generic,
                batch_number=f"BATCH-{uuid.uuid4().hex[:6].upper()}",
                expiry_date=datetime.now(timezone.utc) + timedelta(days=365),
                stock_quantity=qty,
                unit_price=price,
                reorder_level=50.0
            )
            db.add(inv)

        await db.commit()

        print("=== PARTNER ACCOUNT CREATED SUCCESSFULLY ===")
        print(f"Login Email: {partner_email}")
        print(f"Password: {partner_password}")
        print(f"Partner ID: {hospital.id}")
        print(f"Hospyn ID: {hospital.hospyn_id}")
        print("============================================")

if __name__ == "__main__":
    asyncio.run(seed_partner())
