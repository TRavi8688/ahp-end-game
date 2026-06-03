import asyncio
from sqlalchemy import select, text
from app.core.database import get_db, engine
from app.models.models import DoctorVerificationSession

async def check_db():
    print("Checking database for doctor_verification_sessions table...")
    try:
        async with engine.connect() as conn:
            # Check if table exists in sqlite_master
            result = await conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='doctor_verification_sessions'"))
            table = result.fetchone()
            if table:
                print(f"CONFIRMED: Table '{table[0]}' exists.")
                # Count rows
                result = await conn.execute(text("SELECT COUNT(*) FROM doctor_verification_sessions"))
                count = result.scalar()
                print(f"Current row count: {count}")
            else:
                print("FAILED: Table 'doctor_verification_sessions' NOT found.")
    except Exception as e:
        print(f"ERROR: {e}")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_db())
