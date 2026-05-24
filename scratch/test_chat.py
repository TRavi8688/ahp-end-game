import asyncio
import uuid
import sys
from app.services.ai_service import get_ai_service
from app.api.patient import chat_with_chitti

async def mock_chat():
    try:
        ai = await get_ai_service()
        # We just want to see what chat_with_memory raises!
        print("Calling chat_with_memory directly")
        from app.core.database import get_db
        # We need a db session
        db_gen = get_db()
        db = await anext(db_gen)
        # Mock user id
        user_id = "00000000-0000-0000-0000-000000000000"
        conversation_id = "test_chat"
        try:
            res = await ai.chat_with_memory(
                user_id=user_id,
                conversation_id=conversation_id,
                user_message="Hello",
                db=db
            )
            print("Success!", res)
        except Exception as e:
            import traceback
            traceback.print_exc()
        finally:
            await db.close()
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(mock_chat())
