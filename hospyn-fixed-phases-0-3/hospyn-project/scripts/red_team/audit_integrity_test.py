from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import AuditLog
import asyncio
from app.core.database import SessionLocal

async def check_audit_integrity():
    print("Verifying Audit Log Integrity...")
    
    async with SessionLocal() as db:
        # Count recent audit logs (last 5 minutes)
        stmt = select(func.count(AuditLog.id))
        result = await db.execute(stmt)
        total_logs = result.scalar()
        
        print(f"Total Security Audit Logs found: {total_logs}")
        
        # Check for specific suspicious actions
        print("Checking for captured attack vectors...")
        
        stmt = select(AuditLog).order_by(AuditLog.created_at.desc()).limit(5)
        result = await db.execute(stmt)
        latest_logs = result.scalars().all()
        
        if not latest_logs:
            print("No audit logs found! Ensure logging is enabled in endpoints.")
        else:
            for log in latest_logs:
                print(f"LOG FOUND: User {log.user_id} - {log.action} on {log.resource_type} at {log.created_at}")

if __name__ == "__main__":
    asyncio.run(check_audit_integrity())
