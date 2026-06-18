# backend/healthcare-core/app/api/v1/partner_support.py
# Support ticket system
# Partners raise tickets → Hospyn internal team resolves
# SLA timers per priority: critical=4h, high=12h, medium=24h, low=72h

import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_partner
from app.models.partner import Partner
from app.models.support_ticket import SupportTicket

router = APIRouter()

SLA_HOURS = {
    "critical": 4,
    "high":     12,
    "medium":   24,
    "low":      72,
}

VALID_CATEGORIES = {"order_issue", "report_error", "payment_dispute", "system_bug", "other"}
VALID_PRIORITIES = {"low", "medium", "high", "critical"}


class CreateTicketIn(BaseModel):
    category:       str
    subject:        str
    description:    str
    priority:       str = "medium"
    reference_id:   Optional[str] = None
    reference_type: Optional[str] = None  # "order" | "lab_order"


def _ticket_out(t: SupportTicket) -> dict:
    return {
        "id":             str(t.id),
        "ticket_number":  t.ticket_number,
        "category":       t.category,
        "subject":        t.subject,
        "description":    t.description,
        "status":         t.status,
        "priority":       t.priority,
        "reference_id":   t.reference_id,
        "reference_type": t.reference_type,
        "sla_deadline":   t.sla_deadline,
        "created_at":     t.created_at,
        "resolved_at":    t.resolved_at,
        "partner_message": t.partner_message,
        # Internal notes shown to partner as generic updates — never expose full internal detail
        "internal_note":  t.partner_visible_note or "",
    }


@router.get("/support/tickets", response_model=List[dict])
async def list_tickets(
    status:  Optional[str] = None,
    db:      AsyncSession  = Depends(get_db),
    partner: Partner       = Depends(get_current_partner),
):
    query = select(SupportTicket).where(
        SupportTicket.partner_id == partner.id
    ).order_by(SupportTicket.created_at.desc())

    if status:
        query = query.where(SupportTicket.status == status)

    result = await db.execute(query)
    tickets = result.scalars().all()
    return [_ticket_out(t) for t in tickets]


@router.post("/support/tickets", response_model=dict)
async def create_ticket(
    body:    CreateTicketIn,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {VALID_CATEGORIES}")
    if body.priority not in VALID_PRIORITIES:
        raise HTTPException(status_code=400, detail=f"Invalid priority. Must be one of: {VALID_PRIORITIES}")
    if not body.subject.strip():
        raise HTTPException(status_code=400, detail="Subject is required")
    if not body.description.strip():
        raise HTTPException(status_code=400, detail="Description is required")

    # Generate ticket number: TKT-YYYYMMDD-XXXX
    date_str     = datetime.utcnow().strftime("%Y%m%d")
    ticket_num   = f"TKT-{date_str}-{str(uuid.uuid4())[:4].upper()}"
    sla_deadline = datetime.utcnow() + timedelta(hours=SLA_HOURS[body.priority])

    ticket = SupportTicket(
        id=uuid.uuid4(),
        partner_id=partner.id,
        ticket_number=ticket_num,
        category=body.category,
        subject=body.subject.strip(),
        description=body.description.strip(),
        status="open",
        priority=body.priority,
        reference_id=body.reference_id,
        reference_type=body.reference_type,
        sla_deadline=sla_deadline,
        partner_message=None,
        partner_visible_note=None,
        internal_notes=None,
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return _ticket_out(ticket)


@router.get("/support/tickets/{ticket_id}", response_model=dict)
async def get_ticket(
    ticket_id: str,
    db:        AsyncSession = Depends(get_db),
    partner:   Partner      = Depends(get_current_partner),
):
    result = await db.execute(
        select(SupportTicket).where(
            SupportTicket.id == uuid.UUID(ticket_id),
            SupportTicket.partner_id == partner.id,
        )
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _ticket_out(ticket)
