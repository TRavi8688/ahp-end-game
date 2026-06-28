"""
backend/healthcare-core/app/api/v1/auth.py

EXECUTION FIX: this file did not exist. app/api/router.py already imported
`from app.api.v1.auth import router as auth_router`, which broke the
backend's boot (ModuleNotFoundError) before any request could be served.

SCOPE NOTE: actual login/token-issuing lives in auth-service -- nginx routes
public /api/v1/auth/* traffic there directly (see nginx/nginx.conf line ~160),
never to healthcare-core. So this is NOT a second login system; healthcare-core
must never issue tokens. This file holds one genuinely useful, low-risk
endpoint: a "whoami" that lets any authenticated caller confirm how
healthcare-core decoded their token (useful for debugging the hospital_id/
role claim issues found while fixing this codebase -- see core/security.py).
"""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.security import get_current_user, TokenPayload

router = APIRouter()


@router.get("/me")
async def whoami(current_user: Annotated[TokenPayload, Depends(get_current_user)]):
    return {
        "user_id": current_user.sub,
        "role": current_user.role,
        "hospital_id": current_user.hospital_id,
        "token_version": current_user.token_version,
    }
