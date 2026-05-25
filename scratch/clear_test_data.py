import asyncio
import os
from sqlalchemy import text
from app.core.database import get_db

async def clear_test_data():
    async for session in get_db():
        try:
            print("Clearing test data...")
            await session.execute(text("TRUNCATE TABLE messages CASCADE"))
            await session.execute(text("TRUNCATE TABLE ai_summaries CASCADE"))
            await session.execute(text("TRUNCATE TABLE outbox_events CASCADE"))
            
            # Remove uploaded records
            await session.execute(text("TRUNCATE TABLE medical_records CASCADE"))
            
            # Remove visits
            await session.execute(text("TRUNCATE TABLE patient_visits CASCADE"))

            await session.commit()
            print("Test data cleared successfully.")
        except Exception as e:
            print(f"Error: {e}")
            await session.rollback()

if __name__ == "__main__":
    asyncio.run(clear_test_data())
