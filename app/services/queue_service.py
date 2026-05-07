from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.models.queue import QueueToken, QueueTokenStatus
from app.core.outbox import add_event_to_outbox  # assuming you already have this helper


def compute_priority(payload):
    """Backend‑only priority calculation – never trust client provided value.
    Returns an integer >= 10.
    """
    return (
        (100 if getattr(payload, "is_emergency", False) else 0) +
        (60 if getattr(payload, "is_vip", False) else 0) +
        (20 if getattr(payload, "age", None) and payload.age >= 65 else 0) +
        (10 if getattr(payload, "is_follow_up", False) else 0)
    ) or 10


async def create_token(db: AsyncSession, payload, user):
    """Create a queue token in an atomic transaction.
    * tenant‑scoped (uses user.hospital_id)
    * idempotent – returns existing active token if present
    * emits a transactional outbox event
    """
    async with db.begin():  # atomic transaction
        # 1️⃣ Prevent duplicate active tokens for same patient/hospital
        result = await db.execute(
            select(QueueToken).where(
                QueueToken.patient_id == payload.patient_id,
                QueueToken.hospital_id == user.hospital_id,
                QueueToken.status.notin_([
                    QueueTokenStatus.COMPLETED,
                    QueueTokenStatus.EMERGENCY_OVERRIDE,
                ]),
            )
        )
        existing = result.scalar_one_or_none()

        if existing:
            return existing

        # 2️⃣ Compute priority – **backend only**
        priority_score = compute_priority(payload)

        # 3️⃣ Create token record
        token = QueueToken(
            hospital_id=user.hospital_id,
            patient_id=payload.patient_id,
            status=QueueTokenStatus.WAITING,
            priority_score=priority_score,
            created_by_id=user.id,
            last_modified_by_id=user.id,
        )
        db.add(token)
        await db.flush()  # make token.id available for the outbox event

        # 4️⃣ Outbox event (same transaction)
        event = {
            "event_type": "QUEUE.TOKEN_CREATED",
            "event_version": "v1",
            "tenant_id": user.hospital_id,
            "trace_id": getattr(user, "trace_id", None),
            "occurred_at": datetime.utcnow().isoformat(),
            "payload": {
                "token_id": token.id,
                "patient_id": payload.patient_id,
                "priority_score": priority_score,
            },
        }
        add_event_to_outbox(db, event)

        return token


async def list_tokens(db: AsyncSession, hospital_id: int, status=None, limit: int = 50, offset: int = 0):
    """Retrieve tokens for a tenant, optionally filtered by status.
    Ordered by priority (high → low) then creation time (old → new).
    """
    query = select(QueueToken).where(QueueToken.hospital_id == hospital_id)

    if status:
        query = query.where(QueueToken.status == status)

    query = (
        query.order_by(QueueToken.priority_score.desc(), QueueToken.created_at.asc())
        .limit(limit)
        .offset(offset)
    )

    result = await db.execute(query)
    return result.scalars().all()


async def update_token_status(db: AsyncSession, token_id: int, new_status: QueueTokenStatus, user):
    """
    Strict State Machine enforcement for Queue transitions.
    """
    async with db.begin():
        # Enforce DB-Level Tenant Isolation
        result = await db.execute(
            select(QueueToken).where(
                QueueToken.id == token_id,
                QueueToken.hospital_id == user.hospital_id
            )
        )
        token = result.scalar_one_or_none()

        if not token:
            raise ValueError("Token not found or access denied")

        current_status = token.status
        valid_transitions = {
            QueueTokenStatus.WAITING: [QueueTokenStatus.IN_PROGRESS, QueueTokenStatus.EMERGENCY_OVERRIDE],
            QueueTokenStatus.IN_PROGRESS: [QueueTokenStatus.PAUSED, QueueTokenStatus.COMPLETED],
            QueueTokenStatus.PAUSED: [QueueTokenStatus.IN_PROGRESS],
            QueueTokenStatus.EMERGENCY_OVERRIDE: [QueueTokenStatus.IN_PROGRESS, QueueTokenStatus.COMPLETED],
            QueueTokenStatus.COMPLETED: [] # Terminal state
        }

        if new_status not in valid_transitions.get(current_status, []):
            raise ValueError(f"Illegal state transition from {current_status} to {new_status}")

        # Optimistic locking happens automatically via version_id mixin if properly setup
        token.status = new_status
        token.last_modified_by_id = user.id
        
        # Log state change event
        event = {
            "event_type": "QUEUE.STATUS_UPDATED",
            "event_version": "v1",
            "tenant_id": user.hospital_id,
            "occurred_at": datetime.utcnow().isoformat(),
            "payload": {
                "token_id": token.id,
                "old_status": current_status,
                "new_status": new_status,
                "updated_by": user.id,
            },
        }
        add_event_to_outbox(db, event)

        return token
