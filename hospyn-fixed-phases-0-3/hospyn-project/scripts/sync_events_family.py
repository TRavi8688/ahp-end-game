import asyncio
import uuid
from sqlalchemy import text
from app.core.database import primary_engine

async def sync_clinical_events_family_link():
    print("[INFO] Syncing Clinical Events with Family Member IDs...")
    
    async with primary_engine.begin() as conn:
        # 1. Add family_member_id column to clinical_events
        await conn.execute(text("""
            ALTER TABLE clinical_events 
            ADD COLUMN IF NOT EXISTS family_member_id UUID 
            REFERENCES family_members(id) ON DELETE SET NULL
        """))
        print("[SUCCESS] column 'family_member_id' added to 'clinical_events'.")

        # 2. Add Index for filtering
        await conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_clinical_events_family_member_id 
            ON clinical_events (family_member_id)
        """))
        print("[SUCCESS] Index on 'family_member_id' created.")

    print("[DONE] Clinical Timeline Isolation is now enabled.")

if __name__ == "__main__":
    asyncio.run(sync_clinical_events_family_link())
