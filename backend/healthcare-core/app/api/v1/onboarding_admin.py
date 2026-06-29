"""
backend/healthcare-core/app/api/v1/onboarding_admin.py

Super Admin endpoints for hospital approval workflow.

  GET  /onboarding/pending-hospitals       -- list all pending hospitals
  POST /onboarding/reject-hospital/{id}    -- reject with reason, send SMS + email

These are in addition to the existing onboarding.py endpoints:
  POST /onboarding/admin-approve-hospital/{id}  ← already exists

Add to router.py:
  from app.api.v1.onboarding_admin import router as onboarding_admin_router
  api_router.include_router(onboarding_admin_router, prefix="/onboarding", tags=["Onboarding Admin"])
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()


class RejectBody(BaseModel):
    reason:          str
    reupload_fields: Optional[List[str]] = None


# -- GET /onboarding/pending-hospitals -----------------------------------------

@router.get("/pending-hospitals")
async def pending_hospitals(db: AsyncSession = Depends(get_db)):
    """All hospitals awaiting super admin review."""
    result = await db.execute(
        text("""
            SELECT id AS hospital_id, name, email AS owner_email, phone,
                   registration_number, address_line1 AS physical_address,
                   city, state, pin_code, status, created_at
            FROM hospitals
            WHERE status = 'pending_verification'
            ORDER BY created_at ASC
        """)
    )
    rows = [dict(r) for r in result.mappings().all()]
    return {"hospitals": rows, "total": len(rows)}


# -- POST /onboarding/reject-hospital/{hospital_id} ----------------------------

@router.post("/reject-hospital/{hospital_id}")
async def reject_hospital(
    hospital_id: str,
    body:        RejectBody,
    background:  BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Reject a hospital registration with a reason.
    Sends Twilio SMS to owner's phone.
    Sends email via Firebase/SMTP to owner's email.
    Sets hospital status to 'rejected'.
    """
    result = await db.execute(
        text("SELECT id, name, email, phone FROM hospitals WHERE id = :id LIMIT 1"),
        {"id": hospital_id},
    )
    hospital = result.mappings().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found.")

    # Update status to rejected
    await db.execute(
        text("""
            UPDATE hospitals
            SET status = 'rejected', updated_at = :now
            WHERE id = :id
        """),
        {"now": datetime.now(timezone.utc), "id": hospital_id},
    )
    await db.flush()

    # Send notifications in background
    background.add_task(
        _send_rejection_notifications,
        hospital_id=hospital_id,
        name=hospital["name"],
        owner_email=hospital["email"],
        owner_phone=hospital["phone"],
        reason=body.reason,
        reupload_fields=body.reupload_fields or [],
    )

    logger.info("Hospital %s rejected. Reason: %s", hospital_id, body.reason)
    return {"message": f"Hospital {hospital['name']} rejected. Owner has been notified.", "status": "rejected"}


async def _send_rejection_notifications(
    hospital_id:    str,
    name:           str,
    owner_email:    str,
    owner_phone:    str,
    reason:         str,
    reupload_fields: list,
):
    """Send Twilio SMS + email to hospital owner on rejection."""

    fields_str = ", ".join(reupload_fields) if reupload_fields else "required documents"

    sms_body = (
        f"[Hospain] Your hospital '{name}' registration was not approved. "
        f"Reason: {reason}. "
        f"Please re-upload: {fields_str}. "
        f"Log in to hospyn.com to resubmit."
    )

    email_body = f"""
Dear Owner,

Thank you for registering {name} on the Hospyn network.

After reviewing your registration, our verification team was unable to approve it at this time.

Reason for rejection:
{reason}

Documents that need to be re-uploaded:
{chr(10).join(f'  • {f}' for f in reupload_fields) if reupload_fields else '  • All submitted documents'}

What to do next:
1. Log in to https://hospyn.com
2. Click "Register Hospital"
3. Re-upload the required documents
4. Our team will review within 24 hours

If you have any questions, raise a support ticket from the registration page.

Hospain Verification Team
https://hospyn.com
"""

    # -- Twilio SMS ------------------------------------------------------------
    try:
        sid   = os.getenv("TWILIO_ACCOUNT_SID")
        token = os.getenv("TWILIO_AUTH_TOKEN")
        from_ = os.getenv("TWILIO_PHONE_FROM")
        if all([sid, token, from_]) and owner_phone:
            from twilio.rest import Client
            Client(sid, token).messages.create(
                to=owner_phone,
                from_=from_,
                body=sms_body[:1600],  # Twilio SMS limit
            )
            logger.info("Rejection SMS sent to %s for hospital %s", owner_phone[-4:], hospital_id)
    except Exception as e:
        logger.error("Twilio SMS failed for rejection of %s: %s", hospital_id, e)

    # -- Email via SMTP --------------------------------------------------------
    try:
        smtp_host = os.getenv("SMTP_HOST")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_user = os.getenv("SMTP_USER")
        smtp_pass = os.getenv("SMTP_PASSWORD")
        from_email = os.getenv("SMTP_FROM_EMAIL", "noreply@hospyn.com")

        if all([smtp_host, smtp_user, smtp_pass]) and owner_email:
            import smtplib
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart

            msg = MIMEMultipart("alternative")
            msg["Subject"] = f"[Action Required] Hospyn Registration -- {name}"
            msg["From"]    = f"Hospain Verification Team <{from_email}>"
            msg["To"]      = owner_email
            msg.attach(MIMEText(email_body, "plain"))

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.sendmail(from_email, owner_email, msg.as_string())

            logger.info("Rejection email sent to %s for hospital %s", owner_email, hospital_id)
    except Exception as e:
        logger.error("Email failed for rejection of %s: %s", hospital_id, e)
