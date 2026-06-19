import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import get_writer_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Patient
from app.api.patient import get_patient_access_history
from sqlalchemy import select

async def run_simulation():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    try:
        # Get patient
        hospyn_id = "Hospyn-27D6DD82"
        stmt = select(Patient).where(Patient.hospyn_id == hospyn_id)
        res = await db.execute(stmt)
        patient = res.scalars().first()
        
        if not patient:
            print(f"[TEST] Patient {hospyn_id} not found.")
            return
            
        print(f"[TEST] Simulating get_patient_access_history for patient_id={patient.id}...")
        
        # Execute the controller function directly
        result = await get_patient_access_history(current_patient=patient, db=db)
        
        print(f"[TEST] Result returned: {result}")
        print(f"[TEST] Result type: {type(result)}")
        print(f"[TEST] Items count: {len(result)}")
        for idx, item in enumerate(result):
            print(f"  Item {idx}: {item}")

    except Exception as e:
        print(f"[ERROR] Simulation failed: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(run_simulation())
