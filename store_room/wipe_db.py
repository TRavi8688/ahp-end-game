import asyncio
import os
import sys
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# Load env variables from .env if present
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    DATABASE_URL = 'postgresql+asyncpg://neondb_owner:npg_NGAdvihT37kP@ep-falling-shape-ap8b4cm1-pooler.c-7.us-east-1.aws.neon.tech/neondb'

if "sqlite" in DATABASE_URL:
    print("SQLite database detected. For SQLite, database wipe is not supported via this Postgres script.")
    sys.exit(1)

# Ensure it uses asyncpg
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)

# FIX: asyncpg does not support 'sslmode' in the query string.
if "?sslmode=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split("?sslmode=")[0]
elif "&sslmode=" in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.replace("&sslmode=require", "")

engine = create_async_engine(DATABASE_URL)

async def wipe_database():
    print(f"Connecting to database: {DATABASE_URL.split('@')[-1]}")
    async with engine.begin() as conn:
        # Get list of all tables
        result = await conn.execute(text(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        ))
        tables = [row[0] for row in result.fetchall()]
        
        # Exclude alembic_version
        tables_to_wipe = [t for t in tables if t != 'alembic_version']
        
        if not tables_to_wipe:
            print("No tables found to wipe.")
            return

        print(f"Found {len(tables_to_wipe)} tables to wipe (excluding alembic_version).")
        
        # Disable triggers to prevent any audit logging/FK constraint errors during cascade truncate
        # and then truncate all tables with CASCADE.
        for table in tables_to_wipe:
            print(f"Truncating table: {table}")
            await conn.execute(text(f"TRUNCATE TABLE \"{table}\" CASCADE"))
            
        print("Database tables wiped successfully!")

if __name__ == "__main__":
    asyncio.run(wipe_database())
