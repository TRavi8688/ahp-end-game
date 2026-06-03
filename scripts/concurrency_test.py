import asyncio
import sys
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

# Ensure app is in path
sys.path.append(os.getcwd())

from app.core.config import settings
from app.models import models

async def simulate_collision():
    """
    PROVING PHASE 5: Concurrent Write Collision Test.
    Two simultaneous sessions trying to update the same record.
    """
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    print("--- STARTING CONCURRENCY COLLISION TEST ---")
    
    # 1. Prepare a record
    async with async_session() as session:
        # Create or find a medical record
        record = models.MedicalRecord(
            patient_id=1, 
            type="Test", 
            file_url="http://test.com",
            raw_text="Initial state"
        )
        session.add(record)
        await session.commit()
        record_id = record.id
        initial_version = record.version_id
        print(f"Record {record_id} created with version {initial_version}")

    # 2. Open two concurrent sessions
    session1 = async_session()
    session2 = async_session()

    try:
        # Session 1 reads
        res1 = await session1.execute(select(models.MedicalRecord).where(models.MedicalRecord.id == record_id))
        rec1 = res1.scalar_one()
        
        # Session 2 reads
        res2 = await session2.execute(select(models.MedicalRecord).where(models.MedicalRecord.id == record_id))
        rec2 = res2.scalar_one()

        # Session 1 updates first
        rec1.raw_text = "Updated by Session 1"
        await session1.commit()
        print("Session 1: Commit SUCCESS.")

        # Session 2 tries to update (with stale version)
        print("Session 2: Attempting commit with stale version...")
        rec2.raw_text = "Updated by Session 2"
        await session2.commit()
        print("CRITICAL_FAILURE: Session 2 commit succeeded! Lost Update occurred.")
        
    except Exception as e:
        if "StaleDataError" in str(e) or "ObjectDeletedError" in str(e) or "version_id" in str(e).lower():
            print(f"SUCCESS: Session 2 commit FAILED as expected. Error: {type(e).__name__}")
        else:
            print(f"UNEXPECTED_FAILURE: {e}")
    finally:
        await session1.close()
        await session2.close()
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(simulate_collision())
