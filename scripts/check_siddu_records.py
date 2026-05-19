import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import get_writer_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Patient, DoctorAccess
from sqlalchemy import select

async def check_siddu():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    try:
        user_id = "fa5f94ed-4988-4a7f-85e8-3170e1289dd5" # Siddu Tellagorla
        print(f"[DB] Looking up Patient Profile for User ID: {user_id} (Siddu)...")
        
        stmt_pat = select(Patient).where(Patient.user_id == user_id)
        res_pat = await db.execute(stmt_pat)
        patient = res_pat.scalars().first()
        
        if not patient:
            print("[DB] Patient profile not found for Siddu!")
            return
            
        print(f"[DB] Siddu's Patient Details:")
        print(f"     Patient ID: {patient.id}")
        print(f"     Hospyn ID: {patient.hospyn_id}")
        print(f"     Phone: {patient.phone_number}")
        
        # Look up DoctorAccess
        stmt_access = select(DoctorAccess).where(DoctorAccess.patient_id == patient.id)
        res_access = await db.execute(stmt_access)
        records = res_access.scalars().all()
        
        print(f"\n[DB] Doctor Access Records for Siddu ({len(records)} found):")
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
        print(f"[ERROR] failed: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(check_siddu())
