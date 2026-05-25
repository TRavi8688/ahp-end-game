import asyncio
import json
from app.core.database import async_session_maker
from app.models.patient import ChatMessage
from sqlalchemy import select

async def main():
    async with async_session_maker() as db:
        result = await db.execute(select(ChatMessage).order_by(ChatMessage.created_at.desc()).limit(10))
        messages = result.scalars().all()
        for m in messages:
            print(f"Time: {m.created_at}, Role: {m.role}, Content: {m.content}")

if __name__ == "__main__":
    asyncio.run(main())
