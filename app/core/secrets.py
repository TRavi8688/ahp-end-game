import os
import functools
from app.core.logging import logger

@functools.lru_cache()
def get_secret(secret_id: str, default: str = None) -> str:
    """
    ENTERPRISE SECRET MANAGER (SHIELD V5):
    Retrieves secrets from GCP Secret Manager in Production.
    Falls back to Environment Variables in Local/Development.
    """
    env = os.getenv("ENVIRONMENT", "development")
    
    # 1. Production Path: GCP Secret Manager
    if env == "production":
        try:
            from google.cloud import secretmanager
            client = secretmanager.SecretManagerServiceClient()
            project_id = os.getenv("GCP_PROJECT_ID")
            if not project_id:
                # CRITICAL: Production MUST have project ID
                raise RuntimeError("GCP_PROJECT_ID MUST be set in production.")

            name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            logger.critical(f"PRODUCTION_SECRET_ACCESS_DENIED: secret={secret_id} | error={e}")
            # CRITICAL: Hard fail in production to prevent insecure fallback
            raise RuntimeError(f"Could not load required production secret: {secret_id}")

    # 2. Local Path: Environment Variables (Dev Only)
    return os.getenv(secret_id, default)

def load_rsa_key(key_name: str, default_path: str = None) -> str:
    """
    STRICT PEM LOADER:
    - In Production: ONLY loads from Secret Manager.
    - In Development: Falls back to local PEM file.
    """
    env = os.getenv("ENVIRONMENT", "development")
    
    # Try Secret Manager first
    key_data = get_secret(key_name)
    if key_data and "-----BEGIN" in key_data:
        return key_data
    
    # Fallback to local file ONLY in development
    if env != "production" and default_path and os.path.exists(default_path):
        try:
            with open(default_path, "r") as f:
                return f.read()
        except Exception as e:
            logger.error(f"FILE_KEY_LOAD_FAILURE: path={default_path} | error={e}")
            
    if env == "production":
        raise RuntimeError(f"PRODUCTION_KEY_MISSING: RSA key '{key_name}' must be in Secret Manager.")
        
    return ""
