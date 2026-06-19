import asyncio
import uuid
from sqlalchemy import text
from app.core.database import primary_engine

async def add_family_members_table():
    print("[INFO] Initializing Family Members Table Migration...")
    
    async with primary_engine.begin() as conn:
        # 1. Create Family Members Table
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS family_members (
                id UUID PRIMARY KEY,
                patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
                full_name VARCHAR(255) NOT NULL,
                relation VARCHAR(50) NOT NULL,
                phone_number VARCHAR(20),
                blood_group VARCHAR(10),
                gender VARCHAR(20),
                date_of_birth VARCHAR(50),
                linked_hospyn_id VARCHAR(50),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """))
        print("[SUCCESS] Table 'family_members' created or already exists.")

        # 2. Add Index for performance
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_family_members_patient_id ON family_members (patient_id)
        """))
        print("[SUCCESS] Index on 'patient_id' verified.")

        # 3. Verify Patient Relationships (Health Basics)
        await conn.execute(text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_group VARCHAR(10)"))
        await conn.execute(text("ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender VARCHAR(20)"))
        print("[SUCCESS] Patient health baseline columns verified.")

    print("[DONE] Migration Complete! Backend and DB are now synchronized.")

if __name__ == "__main__":
    asyncio.run(add_family_members_table())
