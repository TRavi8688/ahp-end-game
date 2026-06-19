import asyncio
import uuid
from sqlalchemy import text
from app.core.database import primary_engine

async def sync_medical_records_family_link():
    print("[INFO] Syncing Medical Records with Family Member IDs...")
    
    async with primary_engine.begin() as conn:
        # 1. Add family_member_id column to medical_records
        await conn.execute(text("""
            ALTER TABLE medical_records 
            ADD COLUMN IF NOT EXISTS family_member_id UUID 
            REFERENCES family_members(id) ON DELETE SET NULL
        """))
        print("[SUCCESS] column 'family_member_id' added to 'medical_records'.")

        # 2. Add Index for filtering
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_medical_records_family_member_id 
            ON medical_records (family_member_id)
        """))
        print("[SUCCESS] Index on 'family_member_id' created.")

    print("[DONE] Clinical Data Isolation layer is now active.")

if __name__ == "__main__":
    asyncio.run(sync_medical_records_family_link())
