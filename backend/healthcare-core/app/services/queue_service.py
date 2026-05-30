"""
Queue Service

Core business logic for the walk-in queue system.
Handles: QR token signing/validation, duplicate prevention,
queue state transitions, and queue number generation.
"""
import uuid
import hmac
import hashlib
import json
import time
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.models.walkin import (
    WalkInRequest, QueueState, PriorityLevel,
    WalkInSource, ACTIVE_QUEUE_STATES,
)
from app.models.staff import Staff, StaffRole
from app.models.hospital import Hospital
from shared.audit import log_audit_event


# ---------------------------------------------------------------------------
# QR Token Signing (HMAC-SHA256)
# ---------------------------------------------------------------------------

_QR_TOKEN_TTL_SECONDS = 86400 * 365  # 1 year — hospitals print QR codes physically

def generate_walkin_token(hospital_id: str) -> str:
    """
    Generate a signed QR token for a hospital.
    Format: base64(json(hospital_id, iat, exp)).hmac_signature
    """
    payload = {
        "hospital_id": hospital_id,
        "iat": int(time.time()),
        "exp": int(time.time()) + _QR_TOKEN_TTL_SECONDS,
    }
    payload_bytes = json.dumps(payload, separators=(",", ":")).encode()

    import base64
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode()

    signature = hmac.new(
        settings.JWT_SECRET_KEY.encode(),
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

    return f"{payload_b64}.{signature}"


def validate_walkin_token(token: str) -> Optional[str]:
    """
    Validate a signed QR token. Returns hospital_id or None if invalid.
    """
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None

        payload_b64, signature = parts

        import base64
        payload_bytes = base64.urlsafe_b64decode(payload_b64)

        expected_sig = hmac.new(
            settings.JWT_SECRET_KEY.encode(),
            payload_bytes,
            hashlib.sha256
        ).hexdigest()

        if not hmac.compare_digest(signature, expected_sig):
            return None

        payload = json.loads(payload_bytes)

        # Check expiry
        if payload.get("exp", 0) < int(time.time()):
            return None

        return payload.get("hospital_id")
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Duplicate Prevention
# ---------------------------------------------------------------------------

DUPLICATE_COOLDOWN_SECONDS = 300  # 5 minutes

async def check_duplicate_walkin(
    db: AsyncSession, phone: str, hospital_id: uuid.UUID
) -> bool:
    """
    Returns True if there is already an active walk-in request
    for this phone at this hospital. Prevents QR spam.
    """
    active_states = [s.value for s in ACTIVE_QUEUE_STATES]
    result = await db.execute(
        select(WalkInRequest.id).where(
            WalkInRequest.phone == phone,
            WalkInRequest.hospital_id == hospital_id,
            WalkInRequest.queue_state.in_(active_states),
            WalkInRequest.deleted_at.is_(None),
        ).limit(1)
    )
    return result.scalars().first() is not None


# ---------------------------------------------------------------------------
# Queue Number Generator
# ---------------------------------------------------------------------------

async def generate_queue_number(
    db: AsyncSession, hospital_id: uuid.UUID
) -> int:
    """
    Generate today's sequential queue number for a hospital.
    Resets daily. Thread-safe via DB count.
    """
    today_start = datetime.now(timezone.utc).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    result = await db.execute(
        select(func.count(WalkInRequest.id)).where(
            WalkInRequest.hospital_id == hospital_id,
            WalkInRequest.created_at >= today_start,
            WalkInRequest.deleted_at.is_(None),
        )
    )
    count = result.scalar() or 0
    return count + 1


# ---------------------------------------------------------------------------
# Queue State Transitions
# ---------------------------------------------------------------------------

# Valid transition map — prevents illegal state jumps
VALID_TRANSITIONS = {
    QueueState.waiting_reception: {
        QueueState.waiting_triage,
        QueueState.waiting_doctor,
        QueueState.cancelled,
        QueueState.emergency,
    },
    QueueState.waiting_triage: {
        QueueState.in_triage,
        QueueState.cancelled,
        QueueState.no_show,
    },
    QueueState.in_triage: {
        QueueState.waiting_doctor,
        QueueState.emergency,
        QueueState.referred,
    },
    QueueState.waiting_doctor: {
        QueueState.in_consultation,
        QueueState.cancelled,
        QueueState.no_show,
    },
    QueueState.in_consultation: {
        QueueState.completed,
        QueueState.referred,
    },
    QueueState.emergency: {
        QueueState.in_triage,
        QueueState.in_consultation,
        QueueState.completed,
    },
}


def validate_transition(current: QueueState, target: QueueState) -> bool:
    """Check if a queue state transition is valid."""
    allowed = VALID_TRANSITIONS.get(current, set())
    return target in allowed


async def transition_queue_state(
    db: AsyncSession,
    walkin: WalkInRequest,
    new_state: QueueState,
    actor_id: str,
    ip_address: str = None,
) -> WalkInRequest:
    """
    Transition a walk-in request to a new queue state.
    Validates the transition, sets timestamps, and emits audit event.
    Raises ValueError for invalid transitions.
    """
    if not validate_transition(walkin.queue_state, new_state):
        raise ValueError(
            f"Invalid transition: {walkin.queue_state.value} → {new_state.value}"
        )

    old_state = walkin.queue_state
    walkin.queue_state = new_state
    now = datetime.now(timezone.utc)

    # Set lifecycle timestamps based on the target state
    if new_state == QueueState.waiting_triage or new_state == QueueState.waiting_doctor:
        if walkin.accepted_at is None:
            walkin.accepted_at = now
    elif new_state == QueueState.in_triage:
        pass  # Nurse picks up — no special timestamp
    elif new_state == QueueState.waiting_doctor:
        walkin.triaged_at = now
    elif new_state == QueueState.in_consultation:
        walkin.consultation_started_at = now
    elif new_state in (QueueState.completed, QueueState.cancelled, QueueState.no_show):
        walkin.completed_at = now

    log_audit_event(
        action="queue_state_transition",
        actor_id=actor_id,
        target_id=str(walkin.id),
        details={
            "from_state": old_state.value,
            "to_state": new_state.value,
            "hospital_id": str(walkin.hospital_id),
        },
        ip_address=ip_address,
    )

    return walkin


# ---------------------------------------------------------------------------
# Staff Resolution
# ---------------------------------------------------------------------------

async def resolve_staff(
    db: AsyncSession, user_id: str, required_role: StaffRole
) -> Optional[Staff]:
    """
    Resolve a Staff record from the JWT user_id.
    Ensures the staff member has the correct role and is active.
    """
    result = await db.execute(
        select(Staff).where(
            Staff.user_id == uuid.UUID(user_id),
            Staff.role == required_role,
            Staff.is_active == True,
            Staff.deleted_at.is_(None),
        )
    )
    return result.scalars().first()


async def resolve_any_staff(
    db: AsyncSession, user_id: str
) -> Optional[Staff]:
    """
    Resolve any active Staff record (regardless of role) from JWT user_id.
    """
    result = await db.execute(
        select(Staff).where(
            Staff.user_id == uuid.UUID(user_id),
            Staff.is_active == True,
            Staff.deleted_at.is_(None),
        )
    )
    return result.scalars().first()
