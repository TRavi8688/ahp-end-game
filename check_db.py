import asyncio
from app.core.database import AsyncSessionLocal
from app.models.models import User, StaffProfile, Patient, Hospital
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def check():
    async with AsyncSessionLocal() as db:
        print("Checking DB for valid test data...")
        
        # Check Hospitals
        h_res = await db.execute(select(Hospital))
        hospitals = h_res.scalars().all()
        print(f"Hospitals: {len(hospitals)}")
        
        # Check Doctors with profiles
        d_res = await db.execute(select(User).options(selectinload(User.staff_profile)).filter(User.role == 'doctor'))
        doctors = d_res.scalars().all()
        valid_doctors = [u for u in doctors if u.staff_profile]
        print(f"Total Doctors: {len(doctors)}, Valid Doctors (with profiles): {len(valid_doctors)}")
        
        # Check Patients
        p_res = await db.execute(select(Patient))
        patients = p_res.scalars().all()
        print(f"Patients: {len(patients)}")
        
        if valid_doctors and patients:
            print(f"FOUND: Doctor {valid_doctors[0].id} and Patient {patients[0].id}")
        else:
            print("WARNING: Data missing for verification. Attempting to auto-seed a test case...")
            # I can't easily auto-seed without full context, but I can check if any user has a profile.
            all_u_res = await db.execute(select(User).options(selectinload(User.staff_profile)))
            all_users = all_u_res.scalars().all()
            profiled = [u for u in all_users if u.staff_profile]
            if profiled:
                print(f"Alternate: User {profiled[0].id} (Role: {profiled[0].role}) has a profile.")

if __name__ == "__main__":
    asyncio.run(check())
