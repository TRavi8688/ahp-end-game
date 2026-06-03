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
    # SHIELD ENVIRONMENT AUTO-DETECTION: Only query GCP Secret Manager if physically running inside 
    # a GCP container (Cloud Run, GKE) or if Google Application Credentials are explicitly configured.
    # This prevents local developer timeouts of 15s+ when running with ENVIRONMENT=production!
    is_in_gcp = (
        os.getenv("K_SERVICE") is not None or 
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS") is not None or
        os.getenv("GCP_CREDENTIALS_JSON") is not None
    )

    if env == "production" and is_in_gcp:
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
        
    if key_data:
        key_data = key_data.replace("\\n", "\n").replace("\\r", "").replace('"', '').strip()
    
    # Validate that the key actually contains base64 payload besides the headers/footers
    is_valid_pem = False
    if key_data:
        stripped = key_data.replace("-----BEGIN RSA PRIVATE KEY-----", "").replace("-----END RSA PRIVATE KEY-----", "")
        stripped = stripped.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")
        stripped = stripped.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "")
        stripped = "".join(stripped.split())
        if len(stripped) > 50:
            is_valid_pem = True
            
    # Fallback to local file if empty or invalid/placeholder key (e.g. broken GCP Secret Manager value)
    if not is_valid_pem and default_path and os.path.exists(default_path):
        try:
            with open(default_path, "r") as f:
                key_data = f.read()
                logger.info(f"HOSPYN_RSA_LOAD_LOCAL_SUCCESS_FALLBACK: path={default_path} key={key_name}")
        except Exception as e:
            logger.error(f"FILE_KEY_LOAD_FAILURE: path={default_path} | error={e}")

    # Final check of payload validity
    if key_data:
        stripped = key_data.replace("-----BEGIN RSA PRIVATE KEY-----", "").replace("-----END RSA PRIVATE KEY-----", "")
        stripped = stripped.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "")
        stripped = stripped.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "")
        stripped = "".join(stripped.split())
        if len(stripped) < 50:
            key_data = None

    if not key_data:
        env = os.getenv("ENVIRONMENT", "development")
        allow_insecure = os.getenv("HOSPYN_ALLOW_INSECURE_BOOT", "false").lower() == "true"
        if env == "production" and not allow_insecure:
            logger.critical(f"PRODUCTION_KEY_MISSING_OR_INVALID: {key_name}")
            raise RuntimeError(f"CRITICAL AUTH FAILURE: {key_name} is required for Production. Set HOSPYN_ALLOW_INSECURE_BOOT=true to bypass this check in CI/CD pipeline builds.")
        return ""

    # --- AUTO-REPAIR (SHIELD V8.2) ---
    # Fix flattened keys, Windows line endings, and excessive whitespace
    key_data = key_data.strip()
    
    if "-----BEGIN" in key_data:
        logger.info(f"HOSPYN_RSA_AUTO_RECONSTRUCT: key={key_name}")
        
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
        core = clean_data.replace(header.replace(" ", ""), "").replace(footer.replace(" ", ""), "")
        
        # Reconstruct with 64-character lines (Standard PEM framing)
        formatted_core = "\n".join([core[i:i+64] for i in range(0, len(core), 64)])
        key_data = f"{header}\n{formatted_core}\n{footer}\n"

    if "-----BEGIN" in key_data:
        return key_data
    
    logger.error(f"HOSPYN_RSA_LOAD_INVALID_FORMAT: key={key_name}")
    return ""


def derive_public_key(private_key_pem: str) -> str:
    """
    DYNAMIC RSA PUBLIC KEY DERIVATION:
    Extracts and serializes the public key from a standard PEM private key.
    Guarantees public/private key parity and eliminates copy-paste errors.
    """
    if not private_key_pem or "-----BEGIN" not in private_key_pem:
        return ""
    try:
        from cryptography.hazmat.primitives import serialization
        priv_key = serialization.load_pem_private_key(private_key_pem.encode("utf-8"), password=None)
        pub_key = priv_key.public_key()
        pub_pem = pub_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        return pub_pem.decode("utf-8")
    except Exception as e:
        logger.error(f"FAILED_TO_DERIVE_PUBLIC_KEY: {str(e)}")
        return ""
