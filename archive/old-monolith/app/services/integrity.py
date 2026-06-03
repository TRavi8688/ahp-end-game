import hashlib
import hmac
import json
from datetime import datetime
from typing import Any, Dict, Optional
import uuid
from app.core.config import settings

class IntegrityService:
    """
    SOVEREIGN INTEGRITY LAYER:
    Provides cryptographic proof-of-state for all clinical and financial entities.
    Ensures that data cannot be altered without breaking the forensic chain.
    """
    
    def __init__(self, secret_key: str = settings.SECRET_KEY):
        self.secret_key = secret_key.encode()

    def calculate_entity_hash(self, data: Dict[str, Any]) -> str:
        """
        Generates a deterministic SHA-256 hash of the clinical entity's payload.
        Used to 'seal' a record at the moment of creation.
        """
        # Sort keys to ensure deterministic hashing
        serialized = json.dumps(data, sort_keys=True, default=str)
        return hashlib.sha256(serialized.encode()).hexdigest()

    def sign_audit_entry(self, prev_hash: str, current_action: str, resource_id: str) -> str:
        """
        Generates an HMAC-SHA256 signature for an audit log entry.
        Binds the previous hash, the current action, and the resource ID together.
        """
        message = f"{prev_hash}|{current_action}|{resource_id}".encode()
        return hmac.new(self.secret_key, message, hashlib.sha256).hexdigest()

    def verify_integrity(self, data: Dict[str, Any], stored_hash: str) -> bool:
        """
        Verifies if the current state of a record matches its original sealed hash.
        Used for forensic audits and UI-level 'Verified' badges.
        """
        return self.calculate_entity_hash(data) == stored_hash

integrity_service = IntegrityService()
