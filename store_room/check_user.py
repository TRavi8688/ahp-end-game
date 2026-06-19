import asyncio
import sys
sys.path.append('.')
from app.core.database import get_writer_engine
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import User

async def run():
    engine = get_writer_engine()
    Session = sessionmaker(engine, class_=AsyncSession)
    async with Session() as db:
        res = await db.execute(select(User).where(User.email == 'admin@spp04.com'))
        user = res.scalars().first()
        if user:
            print(f"User exists! ID: {user.id}")
            print(f"Active: {user.is_active}")
        else:
            print("User does NOT exist!")

asyncio.run(run())
