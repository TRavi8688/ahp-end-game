# backend/auth-service/app/api/v1/auth.py  (relevant excerpt)
# SEC-7 FIX: Set token as httpOnly cookie on login instead of returning in JSON body.
# Apply the same pattern to staff login for the reception portal.

from fastapi import APIRouter, Response, HTTPException, status, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

router = APIRouter()

COOKIE_NAME = "token"
COOKIE_MAX_AGE = 60 * 60 * 8  # 8 hours


@router.post("/login")
def login(
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Invalid credentials")

    token = create_access_token({"sub": str(user.id), "role": user.role})

    # SEC-7 FIX: Set httpOnly cookie — NOT returned in JSON body.
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,       # JavaScript cannot access this cookie
        secure=True,         # Only sent over HTTPS
        samesite="strict",   # CSRF protection
        max_age=COOKIE_MAX_AGE,
        path="/",
    )
    return {"status": "ok"}   # Do NOT return the token value here


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"status": "logged_out"}
