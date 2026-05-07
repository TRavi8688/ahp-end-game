from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import require_roles
from app.schemas.queue import QueueTokenCreate, QueueTokenRead
from app.services.queue_service import create_token, list_tokens

router = APIRouter()

@router.post("/", response_model=QueueTokenRead)
def create_queue_token(
    payload: QueueTokenCreate,
    db: Session = Depends(get_db),
    user = Depends(require_roles("doctor", "nurse", "admin")),
    idempotency_key: str = Header(..., description="Idempotency-Key for safe retries"),
):
    # Router contains no business logic – delegates to service
    return create_token(db, payload, user)

@router.get("/", response_model=list[QueueTokenRead])
def get_queue_tokens(
    status: str | None = None,
    db: Session = Depends(get_db),
    user = Depends(require_roles("doctor", "nurse", "admin")),
):
    return list_tokens(db, user.hospital_id, status)
