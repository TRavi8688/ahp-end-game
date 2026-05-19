import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import get_writer_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Patient, DoctorAccess
from sqlalchemy import select

async def check_siddulu():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    try:
        print("[DB] Looking up Siddulu in database...")
        
        # Look for user with name containing Siddulu
        stmt_user = select(User).where(User.first_name.ilike("%siddulu%") | User.last_name.ilike("%siddulu%"))
        res_user = await db.execute(stmt_user)
        users = res_user.scalars().all()
        
        if not users:
            print("[DB] No User with name containing 'Siddulu' found.")
            # Let's search all users
            stmt_all = select(User).where(User.role == "patient")
            res_all = await db.execute(stmt_all)
            all_u = res_all.scalars().all()
            print(f"[DB] Available patient users in DB:")
            for u in all_u:
                print(f"  - UserID: {u.id}, Name: {u.first_name} {u.last_name}, Username/Email: {u.email}")
            return
            
        for u in users:
            print(f"\n[DB] Found User: ID={u.id}, Name={u.first_name} {u.last_name}, Username/Email={u.email}")
            
            # Lookup Patient profile
            stmt_pat = select(Patient).where(Patient.user_id == u.id)
            res_pat = await db.execute(stmt_pat)
            patient = res_pat.scalars().first()
            
            if not patient:
                print("     Patient profile NOT initialized for this user!")
                continue
                
            print(f"     Patient ID: {patient.id}")
            print(f"     Hospyn ID: {patient.hospyn_id}")
            print(f"     Phone: {patient.phone_number}")
            
            # Lookup DoctorAccess records for this patient
            stmt_access = select(DoctorAccess).where(DoctorAccess.patient_id == patient.id)
            res_access = await db.execute(stmt_access)
            records = res_access.scalars().all()
            
            print(f"     Doctor Access Records ({len(records)} found):")
            for r in records:
                print(f"       - AccessID: {r.id}")
                print(f"         Doctor: {r.doctor_name} (User ID: {r.doctor_user_id})")
                print(f"         Clinic: {r.clinic_name}")
                print(f"         Status: {r.status}")
                print(f"         Created: {r.created_at}")
                print(f"         Granted: {r.granted_at}")
                print(f"         Revoked: {r.revoked_at}")
                print("         " + "-"*30)

    except Exception as e:
        print(f"[ERROR] failed: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(check_siddulu())
