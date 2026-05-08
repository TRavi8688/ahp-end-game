from sqlalchemy import create_engine
from app.core.config import settings
from app.models.models import Base

def init_db():
    print(f"--- Synchronizing Database Schema to {settings.sync_database_url} ---")
    
    # Use sync engine for initial schema creation
    engine = create_engine(settings.sync_database_url)
    
    # This will create all tables (including the new Phase 9 ones)
    Base.metadata.create_all(bind=engine)
    
    print("--- Database Schema Sync Complete ---")

if __name__ == "__main__":
    init_db()
