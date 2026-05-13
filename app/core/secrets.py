import os
import functools
from app.core.logging import logger

# --- SECRET CLASSIFICATION (Resilience Shield V5.1) ---
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
    
    RESILIENCE RULES:
    1. CRITICAL secrets hard-fail startup if missing.
    2. OPTIONAL secrets log a warning and use defaults.
    """
    env = os.getenv("ENVIRONMENT", "development")
    
    # 0. Check Environment First (Cloud Run mounts secrets as env vars)
    val = os.getenv(secret_id)
    if val:
        return val

    # 1. Production Path: GCP Secret Manager (SDK Fallback)
    if env == "production":
        try:
            from google.cloud import secretmanager
            client = secretmanager.SecretManagerServiceClient()
            project_id = os.getenv("GCP_PROJECT_ID")
            if not project_id:
                if secret_id == "GCP_PROJECT_ID":
                     return "" # Prevent circular death
                logger.critical("GCP_PROJECT_ID_MISSING: Production MUST have project ID.")
                raise RuntimeError("GCP_PROJECT_ID MUST be set in production.")

            name = f"projects/{project_id}/secrets/{secret_id}/versions/latest"
            response = client.access_secret_version(request={"name": name})
            return response.payload.data.decode("UTF-8")
        except Exception as e:
            if secret_id in CRITICAL_SECRETS and default is None:
                logger.critical(f"PRODUCTION_CRITICAL_SECRET_MISSING: {secret_id} | error={e}")
                raise RuntimeError(f"CRITICAL STARTUP FAILURE: Required secret '{secret_id}' could not be loaded.")
            
            # Optional secret or default provided
            logger.warning(f"HOSPYN_OPTIONAL_SECRET_MISSING: {secret_id} | error={e}")
            return default if default is not None else ""

    # 2. Local Path: Environment Variables (Dev Only)
    return os.getenv(secret_id, default if default is not None else "")


def load_rsa_key(key_name: str, default_path: str = None) -> str:
    """
    STRICT PEM LOADER:
    - In Production: ONLY loads from Secret Manager.
    - In Development: Falls back to local PEM file.
    """
    logger.info(f"HOSPYN_RSA_LOAD_BEGIN: key={key_name}")
    try:
        # 0. Check Environment First
        key_data = os.getenv(key_name)
        if not key_data:
            # Try Secret Manager / Local
            key_data = get_secret(key_name)
        
        if key_data and "-----BEGIN" in key_data:
            logger.info(f"HOSPYN_RSA_LOAD_SUCCESS: key={key_name} | prefix={key_data[:15]}...")
            return key_data
        else:
            logger.error(f"HOSPYN_RSA_LOAD_INVALID_FORMAT: key={key_name} | length={len(key_data) if key_data else 0}")
        
        # Fallback to local file ONLY in development
        env = os.getenv("ENVIRONMENT", "development")
        if env != "production" and default_path and os.path.exists(default_path):
            try:
                with open(default_path, "r") as f:
                    logger.info(f"HOSPYN_RSA_LOAD_LOCAL_SUCCESS: path={default_path}")
                    return f.read()
            except Exception as e:
                logger.error(f"FILE_KEY_LOAD_FAILURE: path={default_path} | error={e}")
                
        if env == "production":
            logger.critical(f"PRODUCTION_KEY_MISSING: RSA key '{key_name}' must be in Secret Manager.")
            raise RuntimeError(f"PRODUCTION_KEY_MISSING: RSA key '{key_name}' must be in Secret Manager.")
            
        return ""
    except Exception as e:
        logger.exception(f"HOSPYN_RSA_LOAD_FATAL_ERROR: key={key_name} | error={e}")
        raise RuntimeError(f"Critical authentication bootstrap failure: {key_name}")
