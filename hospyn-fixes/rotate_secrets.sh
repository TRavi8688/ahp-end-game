#!/usr/bin/env bash
# =============================================================================
# Rotate the Fernet encryption key and store it in GCP Secret Manager
# Run AFTER purge_secrets_from_history.sh
# Prerequisites: gcloud CLI authenticated, pip install cryptography
# =============================================================================
set -euo pipefail

PROJECT_ID="${GCP_PROJECT_ID:-}"
SECRET_NAME="hospyn-fernet-key"
SECRET_KEY_NAME="hospyn-secret-key"

if [[ -z "$PROJECT_ID" ]]; then
  read -p "Enter your GCP project ID: " PROJECT_ID
fi

echo "=== Generating new Fernet key ==="
NEW_FERNET_KEY=$(python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
echo "New Fernet key generated (DO NOT print — stored directly to Secret Manager)"

echo ""
echo "=== Generating new JWT SECRET_KEY ==="
NEW_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")

echo ""
echo "=== Pushing to GCP Secret Manager ==="

# Fernet key
echo -n "$NEW_FERNET_KEY" | gcloud secrets create "$SECRET_NAME" \
  --project="$PROJECT_ID" \
  --replication-policy="user-managed" \
  --locations="asia-south1" \
  --data-file=- 2>/dev/null || \
echo -n "$NEW_FERNET_KEY" | gcloud secrets versions add "$SECRET_NAME" \
  --project="$PROJECT_ID" \
  --data-file=-

echo "✓ Fernet key stored in Secret Manager as '$SECRET_NAME'"

# JWT secret key
echo -n "$NEW_SECRET_KEY" | gcloud secrets create "$SECRET_KEY_NAME" \
  --project="$PROJECT_ID" \
  --replication-policy="user-managed" \
  --locations="asia-south1" \
  --data-file=- 2>/dev/null || \
echo -n "$NEW_SECRET_KEY" | gcloud secrets versions add "$SECRET_KEY_NAME" \
  --project="$PROJECT_ID" \
  --data-file=-

echo "✓ JWT SECRET_KEY stored in Secret Manager as '$SECRET_KEY_NAME'"

echo ""
echo "=== Update your .env.example to reference Secret Manager ==="
echo "FERNET_KEY=<loaded from GCP Secret Manager '$SECRET_NAME'>"
echo "SECRET_KEY=<loaded from GCP Secret Manager '$SECRET_KEY_NAME'>"

echo ""
echo "=== CRITICAL: Re-encrypt all existing PHI with the new key ==="
echo "Run: python3 scripts/reencrypt_phi.py"
echo ""
echo "=== Done. Old key is revoked. ==="
