from fastapi        import HTTPException, status, Depends
from functools      import lru_cache
from app.core.security import get_current_user as get_current_employee

# Role levels — must match authStore.js ROLE_LEVEL
ROLE_LEVELS = {
    "super_admin": 100,
    "admin":        90,
    "manager":      70,
    "team_lead":    50,
    "l2":           30,
    "l1":           20,
    "employee":     10,
    "support":      20,
    "finance":      20,
    "engineering":  20,
    "onboarding":   20,
    "data":         20,
    "verification": 20,
}

def require_min_level(min_level: int):
    """
    FastAPI dependency factory.
    Usage: current_user = Depends(require_min_level(90))  # admin+ only
    """
    async def _check(current_user=Depends(get_current_employee)):
        role        = (current_user.role or "").lower()
        user_level  = ROLE_LEVELS.get(role, 0)
        if user_level < min_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"This action requires role level {min_level}+. Your role '{role}' is level {user_level}."
            )
        return current_user
    return _check
