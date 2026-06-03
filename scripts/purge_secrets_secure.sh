#!/usr/bin/env bash
# SEC-1: Purge enc.key from ALL git history and rotate secrets
# ============================================================
# Run from the repo ROOT on a FRESH BARE CLONE for safety.
# Requires: bfg (https://rtyley.github.io/bfg-repo-cleaner/)
#
# Usage:
#   1. cd /tmp && git clone --mirror https://github.com/TRavi8688/ahp-end-game.git repo.git
#   2. Copy this script into /tmp/
#   3. bash purge_secrets_secure.sh /tmp/repo.git
#   4. Inspect results, then force-push.

set -euo pipefail

REPO_PATH="${1:?Usage: $0 <path-to-bare-repo.git>}"

echo "=== Step 1: Confirm enc.key appears in history ==="
git -C "$REPO_PATH" log --all --full-history -- enc.key || true

echo ""
echo "=== Step 2: Running BFG to delete enc.key from all commits ==="
bfg --delete-files enc.key "$REPO_PATH"

echo ""
echo "=== Step 3: Expire refs and gc to remove dangling objects ==="
git -C "$REPO_PATH" reflog expire --expire=now --all
git -C "$REPO_PATH" gc --prune=now --aggressive

echo ""
echo "=== Step 4: Verify enc.key is gone ==="
FOUND=$(git -C "$REPO_PATH" log --all --full-history -- enc.key 2>&1)
if [ -z "$FOUND" ]; then
  echo "SUCCESS: enc.key no longer appears in history"
else
  echo "WARNING: enc.key still found — manual inspection needed:"
  echo "$FOUND"
fi

echo ""
echo "=== Step 5: Force-push (uncomment when ready) ==="
echo "  git -C $REPO_PATH push --force --all"
echo "  git -C $REPO_PATH push --force --tags"
echo ""
echo "IMPORTANT after push:"
echo "  - All collaborators must delete local clones and re-clone"
echo "  - Invalidate GitHub/GitLab cached objects if applicable"
echo "  - Rotate ALL secrets: FERNET_KEY, JWT_PRIVATE_KEY, DB passwords, Redis password"
