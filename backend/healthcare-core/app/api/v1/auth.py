"""
Auth stub — Healthcare Core delegates authentication to the Auth Service.
This module provides a placeholder router so the import chain doesn't break.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/auth/health", summary="Auth module health check")
async def auth_health():
    return {"status": "ok", "module": "healthcare-core-auth-stub"}
