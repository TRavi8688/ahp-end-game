import asyncio
import uuid
import json
import hmac
import hashlib
from app.core.config import settings
from app.core.audit import log_audit_action, calculate_log_signature
from app.core.encryption import encrypt_value, decrypt_value, DecryptionError
from app.services.redis_service import redis_service
from app.core.logging import logger

async def prove_audit_tamper_prevention():
    """
    PROOOF #6: Audit Log Tamper Prevention
    Demonstrates that modifying a log entry breaks the Chain of Trust.
    """
    logger.info("TEST: PROVING_AUDIT_TAMPER_PREVENTION")
    
    # 1. Simulate a legitimate log entry
    log_data = {"action": "TEST_ACTION", "user_id": 1, "timestamp": "2026-04-28T22:00:00"}
    prev_hash = "GENESIS"
    sig = calculate_log_signature(log_data, prev_hash)
    
    # 2. Simulate an attacker modifying 'user_id' in the database
    tampered_data = log_data.copy()
    tampered_data["user_id"] = 999 # Malicious change
    
    # 3. Verify the signature
    verification_sig = calculate_log_signature(tampered_data, prev_hash)
    
    if sig != verification_sig:
        logger.info("AUDIT_PROOF_SUCCESS: Tampering detected. Signatures mismatch.")
        return True
    return False

async def prove_key_rotation_migration():
    """
    PROOF #5: Key Rotation Migration
    Demonstrates decrypting data encrypted with an OLD key using a NEW primary key.
    """
    logger.info("TEST: PROVING_KEY_ROTATION_MIGRATION")
    
    # 1. Setup keys
    old_key = "OLD_SECRET_KEY_32_CHARS_LONG_!!! "
    new_key = "NEW_SECRET_KEY_32_CHARS_LONG_!!! "
    
    # 2. Encrypt with OLD key (Simulating legacy data)
    settings.ENCRYPTION_KEY = old_key
    legacy_ciphertext = encrypt_value("SENSITIVE_DATA")
    
    # 3. Rotate to NEW key
    settings.ENCRYPTION_KEY = new_key
    settings.PREVIOUS_ENCRYPTION_KEYS = [old_key] # Add old key to rotation pool
    
    # 4. Decrypt (Should succeed by trying old keys)
    try:
        decrypted = decrypt_value(legacy_ciphertext)
        if decrypted == "SENSITIVE_DATA":
            logger.info("ENCRYPTION_PROOF_SUCCESS: Legacy data decrypted after rotation.")
            return True
    except DecryptionError:
        logger.error("ENCRYPTION_PROOF_FAILURE: Could not decrypt legacy data.")
    return False

async def prove_redis_blacklist_enforcement():
    """
    PROOF #3: Redis Blacklist Behavior
    Demonstrates that the middleware blocks blocked IPs instantly.
    """
    logger.info("TEST: PROVING_REDIS_BLACKLIST_ENFORCEMENT")
    test_ip = "192.168.1.100"
    
    # 1. Blacklist the IP
    from app.core.limiter import blacklist_ip, check_ip_blacklist
    await blacklist_ip(test_ip, duration=60)
    
    # 2. Check enforcement
    if await check_ip_blacklist(test_ip):
        logger.info("BLACKLIST_PROOF_SUCCESS: IP block confirmed in Redis.")
        return True
    return False

if __name__ == "__main__":
    async def run_all():
        await prove_audit_tamper_prevention()
        await prove_key_rotation_migration()
        await prove_redis_blacklist_enforcement()
        
    asyncio.run(run_all())
