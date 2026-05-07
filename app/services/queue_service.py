from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from app.models.queue import QueueToken, QueueTokenStatus
from app.events.queue_events import QueueTokenCreated
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


def create_token(db: Session, payload, user):
    """Create a queue token in an atomic transaction.
    * tenant‑scoped (uses user.hospital_id)
    * idempotent – returns existing active token if present
    * emits a transactional outbox event
    """
    with db.begin():  # atomic transaction
        # 1️⃣ Prevent duplicate active tokens for same patient/hospital
        existing = db.execute(
            select(QueueToken).where(
                QueueToken.patient_id == payload.patient_id,
                QueueToken.hospital_id == user.hospital_id,
                QueueToken.status.notin_([
                    QueueTokenStatus.completed,
                    QueueTokenStatus.cancelled,
                    QueueTokenStatus.no_show,
                ]),
            )
        ).scalar_one_or_none()

        if existing:
            return existing

        # 2️⃣ Compute priority – **backend only**
        priority_score = compute_priority(payload)

        # 3️⃣ Create token record
        token = QueueToken(
            hospital_id=user.hospital_id,
            patient_id=payload.patient_id,
            status=QueueTokenStatus.pending,
            priority_score=priority_score,
            created_by_id=user.id,
            last_modified_by_id=user.id,
        )
        db.add(token)
        db.flush()  # make token.id available for the outbox event

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


def list_tokens(db: Session, hospital_id: int, status=None, limit: int = 50, offset: int = 0):
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

    return db.execute(query).scalars().all()
