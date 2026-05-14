
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from app.models.models import Base
from app.core.config import settings

async def init_db():
    engine = create_async_engine(settings.async_database_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("DB initialized with all models.")

if __name__ == "__main__":
    asyncio.run(init_db())
