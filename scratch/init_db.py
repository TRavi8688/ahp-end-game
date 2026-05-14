import asyncio
from app.core.database import get_writer_engine
from app.models.models import Base

async def init_db():
    engine = get_writer_engine()
    async with engine.begin() as conn:
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Done.")

if __name__ == "__main__":
    asyncio.run(init_db())
