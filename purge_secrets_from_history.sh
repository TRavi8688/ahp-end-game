#!/usr/bin/env bash
# =============================================================================
# EMERGENCY: Purge enc.key from all git history
# Run this ONCE locally, then force-push. All collaborators must re-clone.
# Prerequisites: pip install git-filter-repo
# =============================================================================
set -euo pipefail

echo "=== HOSPYN EMERGENCY: Purging enc.key from git history ==="
echo ""
echo "WARNING: This rewrites ALL git history. Every collaborator must:"
echo "  1. Delete their local clone"
echo "  2. Re-clone from the repo after this push"
echo ""
read -p "Have you notified all collaborators? (yes/no): " confirm
if [[ "$confirm" != "yes" ]]; then
  echo "Aborting. Notify all collaborators first."
  exit 1
fi

# Check git-filter-repo is available
if ! command -v git-filter-repo &>/dev/null; then
  echo "Installing git-filter-repo..."
  pip install git-filter-repo --break-system-packages
fi

# Step 1: Remove enc.key from all history
echo ""
echo "[1/5] Removing enc.key from all commits..."
git filter-repo --path enc.key --invert-paths --force

# Step 2: Remove create_admin.py (contains hardcoded bcrypt hash)
echo "[2/5] Removing create_admin.py from all commits..."
git filter-repo --path create_admin.py --invert-paths --force

# Step 3: Ensure files are in .gitignore
echo "[3/5] Verifying .gitignore entries..."
if ! grep -q "enc.key" .gitignore 2>/dev/null; then
  echo "enc.key" >> .gitignore
fi
if ! grep -q "create_admin.py" .gitignore 2>/dev/null; then
  echo "create_admin.py" >> .gitignore
fi

# Step 4: Remove the physical files if they still exist
echo "[4/5] Removing files from working tree..."
rm -f enc.key create_admin.py

# Step 5: Force push (rewrites remote history)
echo "[5/5] Force pushing rewritten history..."
echo ""
echo "ABOUT TO FORCE PUSH — this permanently rewrites GitHub history."
read -p "Confirm force push to origin main (yes/no): " pushconfirm
if [[ "$pushconfirm" == "yes" ]]; then
  git remote add origin-backup "$(git remote get-url origin)" 2>/dev/null || true
  git push origin main --force
  echo ""
  echo "=== Done. enc.key and create_admin.py are purged from all history. ==="
  echo ""
  echo "NEXT STEPS:"
  echo "  1. Rotate the Fernet key immediately (see rotate_secrets.sh)"
  echo "  2. If real PHI was encrypted with the old key, consult legal re: DPDP breach notification"
  echo "  3. Rebuild all Docker images (old images still contain the key in their layers)"
  echo "  4. Revoke the superadmin password and set a new one via create_admin_safe.py"
else
  echo "Push aborted. History has been rewritten locally — push manually when ready."
fi
