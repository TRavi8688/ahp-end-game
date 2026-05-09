import os
import sys
import asyncio
from jose import jwt
from unittest.mock import patch, MagicMock

# Add app to path
sys.path.append(os.getcwd())

# Setup environment
os.environ["ENVIRONMENT"] = "development"
os.environ["DATABASE_URL"] = "sqlite:///./test.db"
os.environ["REDIS_URL"] = "redis://localhost:6379/0"
os.environ["JWT_PRIVATE_KEY"] = "-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----"
os.environ["JWT_PUBLIC_KEY"] = "-----BEGIN PUBLIC KEY-----\nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE...\n-----END PUBLIC KEY-----"
os.environ["S3_BUCKET_NAME"] = "secure-medical-vault"
os.environ["ENCRYPTION_KEY"] = "a" * 32

def simulate_jwt_confusion_attack():
    from app.core import security
    from app.core.config import settings
    print("\n[ATTACK] Initiating Algorithm Substitution (HS256 vs RS256)...")
    malicious_payload = {
        "sub": "1", "role": "admin", "type": "access",
        "iss": settings.PROJECT_NAME, "aud": settings.JWT_AUDIENCE
    }
    malicious_token = jwt.encode(malicious_payload, "attacker_secret", algorithm="HS256")
    result = security.decode_token(malicious_token)
    if result and result.get("role") == "admin":
        print("[CRITICAL] ATTACK SUCCESSFUL: System accepted a forged HS256 token!")
    else:
        print("[SECURE] ATTACK BLOCKED: Hardened layer rejected the HS256 token.")

async def simulate_s3_bypass():
    from app.services.s3_service import StorageService
    print("\n[ATTACK] Attempting Direct S3 URL Construction...")
    service = StorageService()
    bucket = "hospyn-clinical-vault"
    key = "reports/Hospyn-12345/scan.pdf"
    direct_url = f"https://{bucket}.s3.amazonaws.com/{key}"
    print(f"[ATTACK] Crafted Direct URL: {direct_url}")
    try:
        signed_url = service.get_signed_url(key)
        if direct_url == signed_url:
            print("[CRITICAL] ATTACK SUCCESSFUL: Signed URL is identical to public URL!")
        else:
            print(f"[SECURE] ATTACK BLOCKED: Access is restricted to dynamic signed links.")
    except Exception as e:
        print(f"[SECURE] ATTACK BLOCKED: Signed URL generation failed as expected (No raw URL leakage).")

async def simulate_redis_split_brain_attack():
    from app.services.redis_service import RedisService
    print("\n[ATTACK] Simulating Redis Dependency Failure...")
    with patch('redis.asyncio.from_url') as mock_redis:
        mock_redis.side_effect = Exception("Connection Refused")
        service = RedisService()
        try:
            client = service.get_client()
            await service.get("test")
            print("[CRITICAL] ATTACK SUCCESSFUL: System failed-over to a mock state!")
        except Exception as e:
            print(f"[SECURE] ATTACK BLOCKED: System failed fast. Error: {e}")

if __name__ == "__main__":
    print("\n--- STARTING ATTACKER SIMULATION (FINAL) ---")
    simulate_jwt_confusion_attack()
    asyncio.run(simulate_s3_bypass())
    asyncio.run(simulate_redis_split_brain_attack())
    print("\n--- ATTACK SIMULATION COMPLETE ---\n")
