import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found.")
    exit(1)

# Ensure it's a sync URL
if "asyncpg" in db_url:
    db_url = db_url.replace("asyncpg", "psycopg2")

engine = create_engine(db_url)

with engine.connect() as conn:
    print("Dropping all tables and types...")
    conn.execute(text("DROP SCHEMA public CASCADE;"))
    conn.execute(text("CREATE SCHEMA public;"))
    conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
    conn.commit()
    print("Database reset successfully.")
