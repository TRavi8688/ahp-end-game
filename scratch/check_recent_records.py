import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check_recent_records():
    db_url = "postgresql+asyncpg://neondb_owner:npg_NGAdvihT37kP@ep-falling-shape-ap8b4cm1-pooler.c-7.us-east-1.aws.neon.tech/neondb"
    engine = create_async_engine(db_url)
    
    async with engine.connect() as conn:
        # Check recent users
        print("--- 5 Most Recent Users ---")
        res = await conn.execute(text("SELECT id, phone_number, role, hospyn_id, created_at FROM users ORDER BY created_at DESC LIMIT 5"))
        for row in res.fetchall():
            print(row)
            
        # Check recent hospital invites
        print("\n--- 5 Most Recent Hospital Invites ---")
        try:
            res = await conn.execute(text("SELECT id, email, role, created_at, hospyn_id FROM hospital_invites ORDER BY created_at DESC LIMIT 5"))
            for row in res.fetchall():
                print(row)
        except Exception as e:
            print(f"Error querying invites: {e}")
            
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check_recent_records())
