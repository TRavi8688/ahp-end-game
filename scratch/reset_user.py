import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import select
from app.models.models import User
from app.core.security import get_password_hash

async def reset_test_user():
    session = AsyncSessionLocal()
    # Find by phone number identifier
    # In User model, email stores the phone for these accounts
    stmt = select(User).where(User.email.contains('8688533605'))
    result = await session.execute(stmt)
    user = result.scalars().first()
    
    if user:
        user.hashed_password = get_password_hash('DefaultPass123!')
        await session.commit()
        print(f"SUCCESS: Reset password for User {user.id}")
    else:
        print("ERROR: User not found")
    await session.close()

if __name__ == "__main__":
    asyncio.run(reset_test_user())
