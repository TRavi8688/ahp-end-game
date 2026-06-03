import asyncio
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import get_writer_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import User, Patient
from sqlalchemy import select

async def check_patient():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    try:
        hospyn_id = "Hospyn-27D6DD82"
        stmt = select(Patient).where(Patient.hospyn_id == hospyn_id)
        res = await db.execute(stmt)
        patient = res.scalars().first()
        
        if not patient:
            print(f"[DB] Patient {hospyn_id} not found.")
            return
            
        print(f"[DB] Patient ID: {patient.id}")
        print(f"     Hospyn ID: {patient.hospyn_id}")
        print(f"     User ID: {patient.user_id}")
        print(f"     Phone: {patient.phone_number}")
        
        # Now lookup User
        stmt_user = select(User).where(User.id == patient.user_id)
        res_user = await db.execute(stmt_user)
        user = res_user.scalars().first()
        
        if user:
            print(f"[DB] Associated User Details:")
            print(f"     Email: {user.email}")
            print(f"     Name: {user.first_name} {user.last_name}")
            print(f"     Role: {user.role}")
            print(f"     Is Active: {user.is_active}")
        else:
            print(f"[DB] Associated User (ID: {patient.user_id}) NOT FOUND in User table!")

    except Exception as e:
        print(f"[ERROR] failed: {e}")
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(check_patient())
