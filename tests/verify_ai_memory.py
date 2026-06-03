import asyncio
import uuid
import sys
import os

# Add the project root to sys.path
sys.path.append(os.getcwd())

from app.services.ai_service import get_ai_service
from app.core.insforge_client import insforge

async def test_memory():
    ai_service = await get_ai_service()
    
    # Use a fixed test user and conversation
    # Note: If RLS is strictly enforced and auth.uid() is null for anon,
    # this might fail. We use a random UUID to simulate a user.
    # Use the fixed sub ID from the anon token to satisfy RLS while testing
    test_user_id = "12345678-1234-5678-90ab-cdef12345678"
    
    print(f"--- Starting Memory Test for User: {test_user_id} ---")
    
    # 1. Create a conversation
    print("Creating conversation...")
    conv = await insforge.create_record("conversations", {
        "user_id": test_user_id,
        "title": "Test Chat"
    })
    
    if not conv:
        print("Failed to create conversation. (Likely RLS blocking anon insert with specific user_id)")
        # In a real app, the backend should use an admin key or the user's JWT.
        # For this demo, we'll try to proceed or explain the dependency.
        return

    conv_id = conv['id']
    print(f"Conversation created: {conv_id}")

    # 2. Test chat with memory
    print("\nSending first message: 'Hi, I'm Alex. Remember my name.'")
    resp1 = await ai_service.chat_with_memory(test_user_id, conv_id, "Hi, I'm Alex. Remember my name.")
    print(f"AI Response 1: {resp1}")

    print("\nSending second message: 'What is my name?'")
    resp2 = await ai_service.chat_with_memory(test_user_id, conv_id, "What is my name?")
    print(f"AI Response 2: {resp2}")

    # 3. Verify history in DB
    print("\nVerifying history in DB...")
    history = await ai_service.get_chat_history(test_user_id, conv_id)
    print(f"History count: {len(history)}")
    for msg in history:
        print(f"  [{msg['role']}]: {msg['content'][:50]}...")

if __name__ == "__main__":
    asyncio.run(test_memory())
