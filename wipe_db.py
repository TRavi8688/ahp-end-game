import os
import sys
from sqlalchemy import create_engine, text, MetaData
from sqlalchemy.schema import DropTable, DropConstraint

def wipe_db():
    url = os.getenv("DATABASE_URL")
    if not url:
        print("CRITICAL: DATABASE_URL not set.")
        sys.exit(1)
    
    # Alembic/SQLAlchemy compatibility
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    
    print(f"🧹 STARTING FORENSIC WIPE: {url[:20]}...")
    
    try:
        engine = create_engine(url)
        with engine.connect() as conn:
            with conn.begin():
                # 1. Disable constraints
                print("⛓️ Disabling constraints...")
                # 2. Get all table names in public schema
                res = conn.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
                tables = [row[0] for row in res]
                
                if not tables:
                    print("✨ Database is already clean.")
                    return

                print(f"🗑️ Dropping tables: {', '.join(tables)}")
                # 3. Drop all tables with CASCADE
                for table in tables:
                    conn.execute(text(f"DROP TABLE IF EXISTS \"{table}\" CASCADE"))
                
                # 4. Drop all enums/types
                res = conn.execute(text("SELECT typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' AND t.typtype = 'e'"))
                enums = [row[0] for row in res]
                for enum in enums:
                    conn.execute(text(f"DROP TYPE IF EXISTS \"{enum}\" CASCADE"))

                print("✅ FORENSIC WIPE COMPLETED.")
    except Exception as e:
        print(f"❌ WIPE FAILURE: {e}")
        sys.exit(1)

if __name__ == "__main__":
    wipe_db()
