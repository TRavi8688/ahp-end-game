import os
import functools
from app.core.logging import logger

# --- SECRET CLASSIFICATION (Resilience Shield V5.2) ---
CRITICAL_SECRETS = {
    "DATABASE_URL",
    "SECRET_KEY",
    "JWT_PRIVATE_KEY",
    "JWT_PUBLIC_KEY",
    "GCP_PROJECT_ID",
    "ENCRYPTION_KEY"
}

@functools.lru_cache()
def get_secret(secret_id: str, default: str = None) -> str:
    """
    ENTERPRISE SECRET MANAGER (SHIELD V5.1):
    Retrieves secrets from GCP Secret Manager in Production.
    Falls back to Environment Variables in Local/Development.
    """
    env = os.getenv("ENVIRONMENT", "development")
    
    # 0. Check Environment First
    val = os.getenv(secret_id)
    if val:
        return val

    # 1. Production Path: GCP Secret Manager
    if env == "production":
        try:
            from google.cloud import secretmanager
            client = secretmanager.SecretManagerServiceClient()
            project_id = os.getenv("GCP_PROJECT_ID")
            if not project_id:
                if secret_id == "GCP_PROJECT_ID": return ""
                raise RuntimeError("GCP_PROJECT_ID MUST be set in production.")

            name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            if secret_id in CRITICAL_SECRETS and default is None:
                logger.warning(f"PRODUCTION_SECRET_NOT_IN_SM: {secret_id} | error={e}")
            return default if default is not None else ""


    # 2. Local Path
    return os.getenv(secret_id, default if default is not None else "")


def load_rsa_key(key_name: str, default_path: str = None) -> str:
    """
    STRICT PEM LOADER (SHIELD V8.1):
    Priority: ENV -> Secret Manager -> Local File
    """
    key_data = os.getenv(key_name)
    if not key_data:
        key_data = get_secret(key_name)
    
    # Fallback to local file if empty (usually in development)
    if not key_data and default_path and os.path.exists(default_path):
        try:
            with open(default_path, "r") as f:
                key_data = f.read()
                logger.info(f"HOSPYN_RSA_LOAD_LOCAL_SUCCESS: path={default_path} key={key_name}")
        except Exception as e:
            logger.error(f"FILE_KEY_LOAD_FAILURE: path={default_path} | error={e}")

    if not key_data:
        env = os.getenv("ENVIRONMENT", "development")
        if env == "production":
            logger.critical(f"PRODUCTION_KEY_MISSING: {key_name}")
            raise RuntimeError(f"CRITICAL AUTH FAILURE: {key_name} is required for Production.")
        return ""

    # --- AUTO-REPAIR (SHIELD V8.2) ---
    # Fix flattened keys, Windows line endings, and excessive whitespace
    key_data = key_data.strip()
    
    if "-----BEGIN" in key_data:
        # Check if it needs reconstruction (e.g. it's on one line or has spaces)
        lines = key_data.splitlines()
        if len(lines) < 3 or any(" " in line.strip() for line in lines if "BEGIN" not in line and "END" not in line):
            logger.info(f"HOSPYN_RSA_REPAIR_TRIGGERED: key={key_name}")
            
            # Remove all existing whitespace/newlines to get the raw base64 core
            clean_data = "".join(key_data.split())
            
            # Determine correct headers
            if "RSAPRIVATEKEY" in clean_data:
                header, footer = "-----BEGIN RSA PRIVATE KEY-----", "-----END RSA PRIVATE KEY-----"
            elif "PRIVATEKEY" in clean_data:
                header, footer = "-----BEGIN PRIVATE KEY-----", "-----END PRIVATE KEY-----"
            elif "PUBLICKEY" in clean_data:
                header, footer = "-----BEGIN PUBLIC KEY-----", "-----END PUBLIC KEY-----"
            else:
                logger.error(f"HOSPYN_RSA_UNKNOWN_TAGS: key={key_name}")
                return key_data # Return as-is and hope for the best

            # Strip the tags from the clean string to get the pure base64
            # We use a case-insensitive replace of the header/footer strings (without spaces)
            core = clean_data.replace(header.replace("-", "").replace(" ", ""), "").replace(footer.replace("-", "").replace(" ", ""), "")
            # Actually just strip everything before the first valid base64 char after the header
            # But simpler: replace the known headers/footers
            core = clean_data.replace(header.replace(" ", ""), "").replace(footer.replace(" ", ""), "")
            
            # Reconstruct with 64-character lines (Standard PEM framing)
            formatted_core = "\n".join([core[i:i+64] for i in range(0, len(core), 64)])
            key_data = f"{header}\n{formatted_core}\n{footer}\n"

    if "-----BEGIN" in key_data:
        return key_data
    
    logger.error(f"HOSPYN_RSA_LOAD_INVALID_FORMAT: key={key_name}")
    return ""
