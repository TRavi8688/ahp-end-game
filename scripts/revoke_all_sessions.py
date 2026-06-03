import asyncio
import sys
import os
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.logging import logger
from app.models.models import User

async def revoke_all_sessions():
    """
    Enterprise Session Revocation:
    Increments token_version for all active users, forcing all clients to re-authenticate on next request.
    This is extremely secure during a security incident or major deployment.
    """
    engine = create_async_engine(settings.async_database_url)
    AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    logger.info("SESSION_REVOCATION: Initializing token_version increment for all users...")
    
    try:
        async with AsyncSessionLocal() as session:
            # Increment token_version for all users
            stmt = update(User).values(token_version=User.token_version + 1)
            result = await session.execute(stmt)
            await session.commit()
            
            logger.info(f"SESSION_REVOCATION: Completed. Successfully revoked all active sessions. Affected users: {result.rowcount}")
    except Exception as e:
        logger.error(f"SESSION_REVOCATION_FAILURE: Failed to execute token_version increment. Error: {e}")
        raise e
    finally:
        await engine.dispose()

if __name__ == "__main__":
    print("--- Enterprise Active Sessions Revocation Tool ---")
    print("This utility will immediately increment token_version for ALL users in the database.")
    print("ALL active logins, patient sessions, and JWT tokens will be rendered invalid.")
    confirm = input("Are you absolutely sure you want to proceed? (yes/no): ")
    
    if confirm.lower() != "yes":
        print("Revocation cancelled.")
        sys.exit(0)
        
    asyncio.run(revoke_all_sessions())
