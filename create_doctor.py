import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.models.models import User, Doctor
from app.core import security

DATABASE_URL = "sqlite+aiosqlite:///./hospyn.db"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == "doctor@hospyn.local"))
        user = result.scalar_one_or_none()
        
        if not user:
            pwd = security.get_password_hash("Hospyn@123")
            user = User(
                email="doctor@hospyn.local",
                hashed_password=pwd,
                role="doctor",
                first_name="Dr.",
                last_name="Hospyn"
            )
            db.add(user)
            await db.flush()
            
            doctor = Doctor(
                user_id=user.id,
                license_number="MOD-TEST-2026",
                license_status="verified",
                specialty="General Medicine"
            )
            db.add(doctor)
            await db.commit()
            print("Successfully created doctor user!")
        else:
            print("Doctor user already exists.")

if __name__ == "__main__":
    asyncio.run(main())
