from fastapi import APIRouter, Depends, Header
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import require_roles
from app.schemas.queue import QueueTokenCreate, QueueTokenRead, QueueTokenStatus
from app.services.queue_service import create_token, list_tokens, update_token_status

router = APIRouter()

@router.post("/", response_model=QueueTokenRead)
async def create_queue_token(
    payload: QueueTokenCreate,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_roles("doctor", "nurse", "admin")),
    idempotency_key: str = Header(..., description="Idempotency-Key for safe retries"),
):
    # Router contains no business logic – delegates to service
    return await create_token(db, payload, user)

@router.get("/", response_model=list[QueueTokenRead])
async def get_queue_tokens(
    status: str | None = None,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_roles("doctor", "nurse", "admin")),
):
    return await list_tokens(db, user.hospital_id, status)

@router.patch("/{token_id}/status", response_model=QueueTokenRead)
async def update_queue_status(
    token_id: int,
    status: QueueTokenStatus,
    db: AsyncSession = Depends(get_db),
    user = Depends(require_roles("doctor", "nurse", "admin")),
):
    return await update_token_status(db, token_id, status, user)
