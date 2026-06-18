# ─────────────────────────────────────────────────────────────────────────────
# PATCH: backend/auth-service/app/config/settings.py
#
# Add these two fields to the existing Settings class (Pydantic BaseSettings).
# They have safe defaults so existing deployments without them won't crash,
# but OTP delivery simply won't work until the env vars are set.
# ─────────────────────────────────────────────────────────────────────────────

from typing import Optional
# (already imported in your settings file — shown here for clarity)

class Settings(BaseSettings):
    # ... (all existing fields remain unchanged) ...

    # ── Notification service integration ──────────────────────────────────────
    NOTIFICATION_SERVICE_URL: str = "http://notification-service:8004"
    INTERNAL_SERVICE_SECRET: str = ""   # must be set in production

# ─────────────────────────────────────────────────────────────────────────────
# Also add httpx to backend/auth-service/requirements.txt if not already present:
#   httpx==0.27.0
# ─────────────────────────────────────────────────────────────────────────────
