from jose import jwt
import base64
import hashlib

token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE3Nzk3OTc0MjUsImlhdCI6MTc3OTEwNjIyNSwibmJmIjoxNzc5MTA2MjI1LCJzdWIiOiI5ZDY3MmY5OS03OTMwLTQ2NWYtYWFkOS02NDFjZDM2YjRlMDQiLCJyb2xlIjoiZG9jdG9yIiwidGVuYW50X2lkIjpudWxsLCJkZXB0X3Njb3BlIjpbXSwidG9rZW5fdmVyc2lvbiI6MSwidHlwZSI6ImFjY2VzcyIsImlzcyI6Ikhvc3B5biAyLjAgU2VjdXJlIChHQ1ApIiwiYXVkIjoiaG9zcHluLWVudGVycHJpc2UtY2xpZW50cyJ9.-f6SD2RLDcLvsf4UoftoYKs3yADM65iEHoLWZrpaurk"

# Let's test standard secret key list
keys = [
    "placeholder-for-debug-only-change-in-production",
    "hospyn-local-secret-key-for-jwt-signing-v1"
]

for k in keys:
    try:
        payload = jwt.decode(
            token,
            k,
            algorithms=["HS256"],
            audience="hospyn-enterprise-clients",
            options={"verify_iss": False}
        )
        print(f"SUCCESS with key '{k[:10]}...': {payload}")
    except Exception as e:
        print(f"FAILED with key '{k[:10]}...': {e}")
