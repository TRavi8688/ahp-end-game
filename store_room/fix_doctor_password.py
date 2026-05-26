import asyncio
from app.core.database import get_writer_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import User
from app.core.security import get_password_hash
import sys

async def reset_pwd():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    try:
        user_res = await db.execute(select(User).where(User.email=='doctor@hospyn.com'))
        user = user_res.scalars().first()
        if user:
            user.hashed_password = get_password_hash('Hospyn123!')
            await db.commit()
            print('Password reset successfully to Hospyn123!')
        else:
            print('User not found!')
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(reset_pwd())
