import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

engine = create_async_engine('postgresql+asyncpg://postgres:postgres@localhost:5432/hospyn')

async def run():
    async with engine.begin() as conn:
        res = await conn.execute(text("SELECT id, email, first_name, last_name, role FROM users WHERE email='owner_682b82@hospyn.com'"))
        print("USER:", res.fetchall())
        res2 = await conn.execute(text("SELECT * FROM doctors"))
        print("DOCTORS:", res2.fetchall())

if __name__ == "__main__":
    asyncio.run(run())
