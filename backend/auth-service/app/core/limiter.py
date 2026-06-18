import redis
import os
from fastapi import HTTPException

class OTPRateLimiter:
    def __init__(self):
        redis_url = os.environ.get("REDIS_URL", "redis://localhost:6379")
        self.redis = redis.from_url(redis_url)
    
    def check(self, phone: str):
        """Check if phone number can request OTP. Limit: 3 per 10 minutes."""
        key = f"otp_limit:{phone}"
        current = self.redis.get(key)
        
        if current and int(current) >= 3:
            ttl = self.redis.ttl(key)
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded. Try again in {ttl} seconds"
            )
        
        pipe = self.redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, 600)  # 10 minutes
        pipe.execute()