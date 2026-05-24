import asyncio
import sys
import uuid
sys.path.append('.')

from app.core.database import get_writer_engine
from sqlalchemy import select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import User
from app.services.ai_service import get_ai_service

async def run():
    engine = get_writer_engine()
    Session = sessionmaker(engine, class_=AsyncSession)
    async with Session() as db:
        # Get any active user from DB
        res = await db.execute(select(User))
        user = res.scalars().first()
        if not user:
            print("No user found in database! Creating a dummy user for testing...")
            # Create a dummy user to run the test
            user = User(
                email=f"dummy_{uuid.uuid4().hex[:6]}@example.com",
                password_hash="dummy",
                first_name="Test",
                last_name="User",
                is_active=True
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            print(f"Created dummy user: {user.email} with ID: {user.id}")

        print(f"Testing with User ID: {user.id}")
        ai = await get_ai_service()
        
        try:
            print("Calling chat_with_memory...")
            response = await ai.chat_with_memory(
                user_id=str(user.id),
                conversation_id=f"test_chat_{user.id}",
                user_message="Hello Chitti, how are you feeling today?",
                db=db
            )
            print("Response:", response)
        except Exception as e:
            import traceback
            print("EXCEPTIONAL FAULT:")
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run())
