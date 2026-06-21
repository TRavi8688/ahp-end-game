import asyncio
import sys
import os
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.logging import logger
from app.models.models import User, Patient, MedicalRecord, AISummary
from app.core.encryption import decrypt_field, encrypt_field

async def rotate_keys(old_key: str, new_key: str):
    """
    Enterprise Key Rotation: Decrypts with old_key and Re-encrypts with new_key.
    This is a critical operation. Should be run in a maintenance window.
    """
    engine = create_async_engine(settings.async_database_url)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    logger.info("KEY_ROTATION: Starting batch processing...")
    
    async with AsyncSessionLocal() as session:
        # Example for Patient PII
        result = await session.execute(select(Patient))
        patients = result.scalars().all()
        for p in patients:
            if p.phone_number:
                raw = decrypt_field(p.phone_number, old_key)
                p.phone_number = encrypt_field(raw, new_key)
            if p.date_of_birth:
                raw = decrypt_field(p.date_of_birth, old_key)
                p.date_of_birth = encrypt_field(raw, new_key)
        
        # Example for Medical Records
        result = await session.execute(select(MedicalRecord))
        records = result.scalars().all()
        for r in records:
            if r.raw_text:
                raw = decrypt_field(r.raw_text, old_key)
                r.raw_text = encrypt_field(raw, new_key)
        
        await session.commit()
    
    logger.info("KEY_ROTATION: Successfully rotated keys for all PHI records.")
    await engine.dispose()

if __name__ == "__main__":
    import getpass
    print("--- Enterprise Key Rotation Tool ---")
    old_key = getpass.getpass("Enter OLD_KEY: ")
    new_key = getpass.getpass("Enter NEW_KEY: ")
    
    if not old_key or not new_key:
        print("Error: Both keys are required.")
        sys.exit(1)
        
    asyncio.run(rotate_keys(old_key, new_key))
