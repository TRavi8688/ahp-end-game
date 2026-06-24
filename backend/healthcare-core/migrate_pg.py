import asyncio
import asyncpg
import os

async def main():
    # Parse the URL from .env (since we don't load .env automatically in this simple script)
    # The string from .env: postgresql+asyncpg://hospyn:0JPfr3cF891KUHRrikdzzw@localhost:5432/hospyn
    dsn = "postgresql://hospyn:0JPfr3cF891KUHRrikdzzw@localhost:5432/hospyn"
    print(f"Connecting to database...")
    try:
        conn = await asyncpg.connect(dsn)
        print("Connected. Running migration...")
        await conn.execute("ALTER TABLE support_tickets ADD COLUMN source VARCHAR(50) DEFAULT 'web';")
        print("Migration successful! Column 'source' added.")
        await conn.close()
    except asyncpg.exceptions.DuplicateColumnError:
        print("Migration skipped: Column 'source' already exists.")
    except Exception as e:
        print(f"Migration error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
