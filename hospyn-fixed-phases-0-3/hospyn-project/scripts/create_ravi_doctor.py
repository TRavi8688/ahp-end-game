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
from sqlalchemy import select, delete

async def manage_doctor_accounts():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    try:
        print("[DATABASE] Connecting to Neon cloud database...")
        
        # 1. Look for any user account containing "test@doctor" or "doctor" with bad format and delete them
        target_emails = ["test@doctor", "test@doctor.com", "test@doctor.app", "test@doctor.org"]
        for email in target_emails:
            print(f"[DATABASE] Checking for stale account: {email}")
            stmt = select(User).where(User.email == email)
            result = await db.execute(stmt)
            user = result.scalars().first()
            if user:
                print(f"[DATABASE] Found stale user account {user.email} (ID: {user.id}). Purging...")
                
                # Delete Doctor profile first
                await db.execute(delete(Doctor).where(Doctor.user_id == user.id))
                # Delete Staff profile
                await db.execute(delete(StaffProfile).where(StaffProfile.user_id == user.id))
                # Delete User
                await db.execute(delete(User).where(User.id == user.id))
                await db.commit()
                print(f"[DATABASE] Stale user {email} deleted successfully.")

        # 2. Get the default Hospital (HOSP-GLOBAL-001)
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
            print("[DATABASE] Default Hospital created.")

        # 3. Create the brand new Doctor: Dr. Ravi Teja
        ravi_email = "ravi@hospyn.com"
        result_ravi = await db.execute(select(User).where(User.email == ravi_email))
        existing_ravi = result_ravi.scalars().first()
        
        if existing_ravi:
            print(f"[DATABASE] Ravi Teja account already exists. Re-initializing it to ensure fresh state...")
            # Purge existing to make it a completely fresh doctor
            await db.execute(delete(Doctor).where(Doctor.user_id == existing_ravi.id))
            await db.execute(delete(StaffProfile).where(StaffProfile.user_id == existing_ravi.id))
            await db.execute(delete(User).where(User.id == existing_ravi.id))
            await db.commit()
            print(f"[DATABASE] Existing Ravi Teja account deleted.")

        # Create new user
        new_user = User(
            email=ravi_email,
            hashed_password=get_password_hash("Hospyn123!"),
            is_active=True,
            role="doctor",
            first_name="Ravi",
            last_name="Teja"
        )
        db.add(new_user)
        await db.flush()
        
        # Create Staff Profile
        staff_profile = StaffProfile(
            user_id=new_user.id,
            hospital_id=hospital.id
        )
        db.add(staff_profile)
        
        # Create Doctor Profile
        doctor_profile = Doctor(
            user_id=new_user.id,
            specialty="General Medicine & Cardiology",
            license_number="LIC-RAVI-9999",
            license_status="verified"
        )
        db.add(doctor_profile)
        
        await db.commit()
        print(f"\n[DATABASE] SUCCESS: Fresh Doctor Account Created!")
        print(f"  - Name: Dr. Ravi Teja")
        print(f"  - Login Email: {ravi_email}")
        print(f"  - Password: Hospyn123!")
        print(f"  - Role: doctor (verified)")
        print(f"  - Hospital ID: {hospital.hospyn_id}")
        print(f"  - License Number: LIC-RAVI-9999 (verified)")

    except Exception as e:
        print(f"[ERROR] Error executing database manager: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(manage_doctor_accounts())
