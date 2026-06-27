from slowapi import Limiter
from slowapi.util import get_remote_address

import os
limiter = Limiter(
    key_func=get_remote_address,
    strategy="moving-window",
    default_limits=["1000 per day", "200 per hour"],
    enabled=(os.environ.get("ENV") != "test" and os.environ.get("ENVIRONMENT") != "test")
)
