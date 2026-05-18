import asyncio
import sys
import os

# Add parent dir to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import get_writer_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.models import User
from app.core import security
from app.core.audit import log_clinical_audit as log_audit_action

async def diagnose():
    print("--- FORENSIC LOGIN DIAGNOSTIC START ---")
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    
    test_emails = ["doctor@hospyn.com", "test@hospyn.com"]
    password = "Hospyn123!"
    
    for email in test_emails:
        print(f"\n[Trace] Testing login for: {email}")
        try:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalars().first()
            if not user:
                print(f"❌ User {email} NOT found in database.")
                continue
            
            print(f"✅ User found. ID={user.id}, Role={user.role}")
            print(f"Checking password hash verification...")
            pwd_match = security.verify_password(password, user.hashed_password)
            print(f"Password match result: {pwd_match}")
            
            if not pwd_match:
                print("Logging audit failure...")
                await log_audit_action(db, user_id=None, action="LOGIN_FAILURE", resource_type="USER", details={"email": email})
                print("Audit failure logged successfully.")
            else:
                user.is_active = True
                await db.commit()
                print("Database commit succeeded.")
                
                print("Generating access token...")
                access_token = security.create_access_token(user.id, user.role)
                print("Generating refresh token...")
                refresh_token = security.create_refresh_token(user.id, user.role)
                print(f"✅ Tokens successfully generated! Token length={len(access_token)}")
                
                print("Logging audit success...")
                await log_audit_action(db, user_id=user.id, action="LOGIN_SUCCESS", resource_type="AUTH")
                print("Audit success logged successfully.")
                
        except Exception as e:
            import traceback
            print(f"❌ CRITICAL EXCEPTION TRACEBACK:")
            traceback.print_exc()
            
    await db.close()
    await engine.dispose()
    print("\n--- DIAGNOSTIC COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(diagnose())
