import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_schema():
    db_url = "postgresql+asyncpg://neondb_owner:npg_NGAdvihT37kP@ep-falling-shape-ap8b4cm1-pooler.c-7.us-east-1.aws.neon.tech/neondb"
    engine = create_async_engine(db_url)
    
    # 1. Print all tables
    async with engine.connect() as conn:
        print("--- Table Columns Check ---")
        for table in ["users", "staff_profiles", "hospital_invites"]:
            try:
                res = await conn.execute(text(f"SELECT * FROM {table} LIMIT 1"))
                print(f"Table '{table}' columns: {list(res.keys())}")
            except Exception as e:
                print(f"Failed to query '{table}': {e}")
                
        # Let's inspect the latest logs in clinical_audit_logs if any
        try:
            res = await conn.execute(text("SELECT * FROM clinical_audit_logs ORDER BY timestamp DESC LIMIT 5"))
            print("\n--- Latest Clinical Audit Logs ---")
            for row in res.fetchall():
                print(row)
        except Exception as e:
            print(f"Failed to query audit logs: {e}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_schema())
