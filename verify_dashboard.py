import sys
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import User, Patient
from app.services.dashboard_service import DashboardService
from app.core.database import get_db, AsyncSessionLocal
import time

async def verify_dashboard():
    """
    Asynchronous verification of the patient dashboard aggregation and retrieval.
    Aligned with the production asyncpg engine.
    """
    print("--- Starting Async Dashboard Verification ---")
    async with AsyncSessionLocal() as db:
        try:
            # 1. Check for exitence of patient #1 (Mock)
            from sqlalchemy import select
            stmt = select(Patient).where(Patient.id == 1)
            result = await db.execute(stmt)
            patient = result.scalar_one_or_none()
            
            if not patient:
                print("Creating mock patient...")
                user = User(email="test@example.com", first_name="Test", last_name="User", role="patient")
                db.add(user)
                await db.flush()
                patient = Patient(user_id=user.id, hospyn_id="Hospyn-TEST", blood_group="O+", phone_number="1234567890")
                db.add(patient)
                await db.commit()
                await db.refresh(patient)
                print(f"Created Patient ID: {patient.id}")

            service = DashboardService(db)

            # 2. Test Aggregation
            print("Testing aggregation...")
            start_time = time.time()
            data = await service.aggregate_dashboard_data(patient.id)
            print(f"Aggregation took: {time.time() - start_time:.4f}s")
            print(f"Data Sample (Profile): {data.get('profile', {}).get('full_name')}")

            # 3. Test Redis Retrieval
            print("Testing Redis retrieval...")
            start_time = time.time()
            cached_data = await service.get_dashboard(patient.id)
            elapsed = time.time() - start_time
            print(f"Redis/Cache retrieval took: {elapsed:.4f}s")
            
            if elapsed < 0.05: # Adjusted for local dev overhead
                print("✅ SUCCESS: High-performance retrieval confirmed.")
            else:
                print("⚠️ WARNING: Retrieval slower than expected.")

        except Exception as e:
            print(f"❌ ERROR: {str(e)}")
            await db.rollback()
        finally:
            await db.close()

if __name__ == "__main__":
    asyncio.run(verify_dashboard())
