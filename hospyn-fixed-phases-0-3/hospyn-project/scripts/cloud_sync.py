import asyncio
import sys
import os
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.models import Base, User, Hospital, Patient, Doctor, Department, StaffProfile, PatientVisit, MedicalRecord, Condition, Medication, Allergy, FamilyMember, QueueToken, Bed, Admission, DigitalPrescription, LabTestMaster, LabDiagnosticOrder, LabResult, PharmacyStock, ClinicalEvent
from app.core.logging import logger

# Configuration for Migration
# The user should set REMOTE_DATABASE_URL in .env before running this.
LOCAL_URL = "sqlite:///./hospyn_local.db" # Use sync sqlite for migration read
REMOTE_URL = os.getenv("REMOTE_DATABASE_URL")

def migrate_data():
    if not REMOTE_URL:
        print("ERROR: REMOTE_DATABASE_URL not found in environment.")
        print("Please add REMOTE_DATABASE_URL=postgresql://user:pass@host/db to your .env")
        return

    print(f"--- CLINICAL DATA MIGRATION: LOCAL -> CLOUD ---")
    print(f"Source: {LOCAL_URL}")
    print(f"Destination: {REMOTE_URL.split('@')[-1]}")
    
    # 1. Setup Engines
    source_engine = create_engine(LOCAL_URL)
    dest_engine = create_engine(REMOTE_URL)
    
    SourceSession = sessionmaker(bind=source_engine)
    DestSession = sessionmaker(bind=dest_engine)
    
    source_session = SourceSession()
    dest_session = DestSession()
    
    # 2. Ensure Schema exists on remote
    print("STEP 1: Initializing Cloud Schema...")
    Base.metadata.create_all(dest_engine)
    
    # 3. Tables to migrate in order
    tables = [
        User, Hospital, Patient, Doctor, Department, StaffProfile,
        PatientVisit, MedicalRecord, Condition, Medication, Allergy,
        FamilyMember, QueueToken, Bed, Admission, DigitalPrescription,
        LabTestMaster, LabDiagnosticOrder, LabResult, PharmacyStock,
        ClinicalEvent
    ]
    
    print("STEP 2: Transferring Records...")
    try:
        for model in tables:
            name = model.__tablename__
            print(f" -> Migrating table: {name}...", end="", flush=True)
            
            # Fetch all from source
            items = source_session.query(model).all()
            if not items:
                print(" [Skipped: Empty]")
                continue
                
            # Merge into destination (to handle existing data or restarts)
            for item in items:
                # Expunge from source session to avoid identity conflicts when merging
                source_session.expunge(item)
                dest_session.merge(item)
            
            dest_session.commit()
            print(f" [Done: {len(items)} records]")
            
        print("\n--- CLINICAL MIGRATION SUCCESSFUL ---")
        print("Your Hospyn cloud node is now synchronized with local forensic data.")
        
    except Exception as e:
        dest_session.rollback()
        print(f"\nFATAL MIGRATION ERROR: {str(e)}")
        logger.error(f"MIGRATION_ERROR: {str(e)}")
    finally:
        source_session.close()
        dest_session.close()

if __name__ == "__main__":
    # Check if user wants to proceed
    confirm = input("This will overwrite/merge data in your REMOTE database. Proceed? (y/n): ")
    if confirm.lower() == 'y':
        migrate_data()
    else:
        print("Migration aborted.")
