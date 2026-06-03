import asyncio
import sys
import os
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.models.models import AuditLog, OTPVerification, User

async def check_historical_abuse():
    """
    Forensics & Auditing:
    Checks the database tables (AuditLog, OTPVerification, User) for any logs or records
    indicating historical exploitation or usage of the sandbox authentication bypass
    ('sandbox_mock_') or the hardcoded demo OTP bypass ('8688533605').
    """
    engine = create_async_engine(settings.async_database_url)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    print("\n[Hospyn Security Audit Forensics]")
    print("Scanning database for historical authentication bypass patterns...\n")
    
    async with AsyncSessionLocal() as session:
        # 1. Scan for OTP bypass attempts (+918688533605 or 8688533605)
        print("Checking OTPVerification logs for target demo phone number '8688533605'...")
        try:
            result_otp = await session.execute(
                select(OTPVerification)
                .where(
                    OTPVerification.identifier.in_(["8688533605", "+918688533605"])
                )
                .order_by(OTPVerification.created_at.desc())
            )
            otps = result_otp.scalars().all()
            
            if otps:
                print(f"WARNING: FOUND {len(otps)} OTP verification records for the demo phone number:")
                for o in otps[:10]:
                    print(f"  - ID: {o.id} | OTP: {o.otp} | Created: {o.created_at} | Expires: {o.expires_at}")
                if len(otps) > 10:
                    print(f"  ... and {len(otps) - 10} more.")
            else:
                print("OK: No OTP records found for the demo phone number.")
        except Exception as e:
            print(f"INFO: Could not scan OTPVerification table: {e}")
            
        print("\n" + "-"*60 + "\n")
        
        # 2. Scan AuditLogs for sandbox_mock_ or demo log ins
        print("Checking AuditLog entries for bypass events ('sandbox_mock_') or demo login logs...")
        try:
            result_audit = await session.execute(
                select(AuditLog)
                .order_by(AuditLog.timestamp.desc())
            )
            audit_records = result_audit.scalars().all()
            
            suspicious_audit = []
            for a in audit_records:
                details_str = str(a.details or "")
                if "sandbox_mock" in details_str or "8688533605" in details_str:
                    suspicious_audit.append(a)
                    
            if suspicious_audit:
                print(f"ALERT: FOUND {len(suspicious_audit)} SUSPICIOUS AUDIT LOG ENTRIES:")
                for a in suspicious_audit[:10]:
                    print(f"  - Timestamp: {a.timestamp} | Action: {a.action} | User ID: {a.user_id} | Details: {a.details}")
                if len(suspicious_audit) > 10:
                    print(f"  ... and {len(suspicious_audit) - 10} more.")
            else:
                print("OK: No audit trail records indicating 'sandbox_mock' or demo identifier usage were found.")
        except Exception as e:
            print(f"INFO: Could not scan AuditLog table: {e}")
            
        print("\n" + "-"*60 + "\n")
        
        # 3. Check for users created with sandbox/mock email domains (highly resilient to schema)
        print("Scanning User table for suspicious sandbox/mock accounts...")
        try:
            result_users = await session.execute(
                text("SELECT id, phone_number, role, is_active FROM users WHERE phone_number LIKE :sandbox OR phone_number LIKE :mock"),
                {"sandbox": "%sandbox%", "mock": "%mock%"}
            )
            users = result_users.all()
            
            if users:
                print(f"WARNING: FOUND {len(users)} SUSPICIOUS accounts in the User database:")
                for u in users:
                    print(f"  - ID: {u.id} | Email/Phone: {u.phone_number} | Role: {u.role} | Active: {u.is_active}")
            else:
                print("OK: No suspicious sandbox or mock accounts found.")
        except Exception as e:
            print(f"INFO: Could not scan user table via direct SQL text query: {e}")
            
    await engine.dispose()
    print("\nForensics scan complete.")

if __name__ == "__main__":
    asyncio.run(check_historical_abuse())
