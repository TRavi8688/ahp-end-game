"""
Consent Check Middleware
Enforces DPDP Act 2023 requirement that patients must have active data_processing
consent before their clinical data is returned.

Applies to all clinical data endpoints; bypassed for emergency paths and the
consent endpoints themselves.
"""

from __future__ import annotations

import re
from typing import Optional
from uuid import UUID

from fastapi import Request
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_sync          # sync helper for middleware
from app.models import ConsentRecord

# ─── Path configuration ───────────────────────────────────────────────────────

# Regex patterns that REQUIRE active data_processing consent.
# These match any path that surfaces individual patient clinical data.
_CONSENT_REQUIRED_PATTERNS: list[re.Pattern] = [
    re.compile(r"^/api/v1/patients/[^/]+/records"),
    re.compile(r"^/api/v1/clinical"),
    re.compile(r"^/api/v1/prescriptions"),
    re.compile(r"^/api/v1/lab-results"),
    re.compile(r"^/api/v1/appointments/[^/]+"),   # individual appointment detail
]

# Paths that bypass consent check entirely.
_BYPASS_PREFIXES: tuple[str, ...] = (
    "/api/v1/consent",           # consent endpoints themselves
    "/api/v1/data-rights",       # deletion / portability (self-service)
    "/api/v1/emergency",         # emergency care — deemed consent under DPDP §7(b)
    "/api/v1/auth",              # authentication
    "/api/v1/legal",             # legal documents
    "/health",                   # load-balancer health check
    "/docs",                     # OpenAPI docs
    "/openapi.json",
)


def _path_requires_consent(path: str) -> bool:
    if path.startswith(_BYPASS_PREFIXES):
        return False
    return any(p.match(path) for p in _CONSENT_REQUIRED_PATTERNS)


def _extract_patient_id(request: Request) -> Optional[UUID]:
    """
    Try to extract patient_id from:
    1. Path parameters (e.g. /patients/{id}/records)
    2. Query parameters (?patient_id=...)
    3. JWT claims already parsed by auth middleware (request.state.patient_id)
    """
    # From request state (set by auth middleware)
    if hasattr(request.state, "patient_id") and request.state.patient_id:
        try:
            return UUID(str(request.state.patient_id))
        except (ValueError, AttributeError):
            pass

    # From path parameters
    path_params = request.path_params or {}
    for key in ("patient_id", "id"):
        if key in path_params:
            try:
                return UUID(path_params[key])
            except ValueError:
                pass

    # From query string
    patient_id_qs = request.query_params.get("patient_id")
    if patient_id_qs:
        try:
            return UUID(patient_id_qs)
        except ValueError:
            pass

    return None


async def _has_active_consent(patient_id: UUID, db: AsyncSession) -> bool:
    """Returns True if the patient has an un-revoked data_processing consent record."""
    result = await db.execute(
        select(ConsentRecord).where(
            ConsentRecord.patient_id == patient_id,
            ConsentRecord.consent_type == "data_processing",
            ConsentRecord.revoked_at.is_(None),
        ).limit(1)
    )
    return result.scalar_one_or_none() is not None


async def consent_check_middleware(request: Request, call_next):
    """
    FastAPI middleware that enforces DPDP data_processing consent.

    Flow:
      1. Check if the requested path requires consent.
      2. If not, pass through immediately.
      3. Extract patient_id from the request.
      4. Query consent_records for an active data_processing record.
      5. If absent, return HTTP 403 with a DPDP-compliant error body.
      6. If present, proceed to the next handler.

    Emergency paths (/api/v1/emergency) bypass this check pursuant to
    DPDP Act 2023 §7(b) (deemed consent for health emergencies).
    """
    path: str = request.url.path

    if not _path_requires_consent(path):
        return await call_next(request)

    patient_id = _extract_patient_id(request)

    if patient_id is None:
        # Cannot determine patient — let the endpoint handle auth/validation
        return await call_next(request)

    # Use a fresh DB session for the middleware check
    async for db in get_db_sync():
        has_consent = await _has_active_consent(patient_id, db)
        break  # type: ignore[assignment]

    if not has_consent:
        return JSONResponse(
            status_code=403,
            content={
                "error": "consent_required",
                "message": (
                    "Access to clinical data requires your explicit consent under the "
                    "Digital Personal Data Protection Act 2023. "
                    "Please grant data_processing consent to continue."
                ),
                "action_required": "POST /api/v1/consent/grant",
                "dpdp_section": "Section 6 — Consent",
            },
        )

    return await call_next(request)
