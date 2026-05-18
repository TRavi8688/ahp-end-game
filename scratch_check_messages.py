import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.models.models import Message

async def main():
    sys.stdout.reconfigure(encoding='utf-8')
    engine = create_async_engine(settings.DATABASE_URL)
    async with AsyncSession(engine) as session:
        result = await session.execute(select(Message).order_by(Message.created_at.desc()).limit(15))
        messages = result.scalars().all()
        print("LAST 15 MESSAGES IN DATABASE:")
        for msg in reversed(messages):
            print(f"- [{msg.role}] {msg.user_id}: {repr(msg.content)}")

if __name__ == "__main__":
    asyncio.run(main())
