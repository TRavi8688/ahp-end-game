import asyncio
import os
from dotenv import load_dotenv

load_dotenv()
import redis.asyncio as redis

async def reset_cb():
    r = redis.Redis.from_url(os.getenv("REDIS_URL", "redis://localhost:6379/0"))
    keys = await r.keys("cb:*")
    if keys:
        await r.delete(*keys)
        print(f"Deleted {len(keys)} circuit breaker keys.")
    else:
        print("No circuit breaker keys found.")

asyncio.run(reset_cb())
