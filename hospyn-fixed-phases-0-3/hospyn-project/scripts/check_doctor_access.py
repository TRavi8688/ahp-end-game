import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import get_writer_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Patient, DoctorAccess
from sqlalchemy import select

async def check_access():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    try:
        print("[DB CHECK] Checking DoctorAccess records...")
        
        # 1. Get the patient with hospyn_id = "Hospyn-27D6DD82"
        hospyn_id = "Hospyn-27D6DD82"
        # Try both case formats
        stmt = select(Patient).where(Patient.hospyn_id == hospyn_id)
        res = await db.execute(stmt)
        patient = res.scalars().first()
        
        if not patient:
            stmt = select(Patient).where(Patient.hospyn_id.ilike(hospyn_id))
            res = await db.execute(stmt)
            patient = res.scalars().first()
            
        if not patient:
            print(f"[DB CHECK] Patient '{hospyn_id}' not found in database!")
            # List all patients to see what exists
            stmt = select(Patient)
            res = await db.execute(stmt)
            all_patients = res.scalars().all()
            print(f"[DB CHECK] Available Patients in Database:")
            for p in all_patients:
                print(f"  - ID: {p.id}, HospynID: {p.hospyn_id}, Phone: {p.phone_number}")
            return

        print(f"[DB CHECK] Found Patient: ID={patient.id}, HospynID={patient.hospyn_id}")
        
        # 2. Get all DoctorAccess entries for this patient
        stmt_access = select(DoctorAccess).where(DoctorAccess.patient_id == patient.id)
        res_access = await db.execute(stmt_access)
        records = res_access.scalars().all()
        
        print(f"[DB CHECK] Access History Records ({len(records)} found):")
        for r in records:
            print(f"  - AccessID: {r.id}")
            print(f"    Doctor: {r.doctor_name} (User ID: {r.doctor_user_id})")
            print(f"    Clinic: {r.clinic_name}")
            print(f"    Status: {r.status}")
            print(f"    Created: {r.created_at}")
            print(f"    Granted: {r.granted_at}")
            print(f"    Revoked: {r.revoked_at}")
            print("-" * 40)

    except Exception as e:
        print(f"[ERROR] DB Check failed: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(check_access())
