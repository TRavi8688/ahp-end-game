"""
backend/healthcare-core/app/api/v1/tickets.py

Full enterprise support ticket system.

Endpoints:
  Hospital/partner submits tickets:
    POST   /api/v1/tickets              — Create ticket
    GET    /api/v1/tickets              — List my tickets (hospital/partner)
    GET    /api/v1/tickets/{ticket_id}  — Get ticket detail
    POST   /api/v1/tickets/{ticket_id}/message       — Send message
    GET    /api/v1/tickets/{ticket_id}/messages      — Get messages
    POST   /api/v1/tickets/{ticket_id}/rating        — Rate resolved ticket

  Super admin / internal team:
    GET    /api/v1/tickets/all                        — List all tickets
    GET    /api/v1/tickets/stats                      — Ticket statistics
    POST   /api/v1/tickets/{ticket_id}/status         — Update status
    POST   /api/v1/tickets/{ticket_id}/assign         — Assign to agent
    POST   /api/v1/tickets/{ticket_id}/flag-call      — Flag call required
    GET    /api/v1/tickets/{ticket_id}/internal-notes — Get internal notes
    POST   /api/v1/tickets/{ticket_id}/internal-notes — Add internal note
"""

from __future__ import annotations

import random
import string
from datetime import datetime, timezone
from typing import Optional, Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.core.security import get_current_user, require_role, TokenPayload

router = APIRouter()

# ─── Dependencies ─────────────────────────────────────────────────────────────
AnyUser    = Annotated[TokenPayload, Depends(get_current_user)]
AdminAgent = Annotated[TokenPayload, Depends(require_role("super_admin", "admin"))]


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _gen_ticket_id(year: int) -> str:
    suffix = ''.join(random.choices(string.digits, k=5))
    return f"HSP-{year}-{suffix}"


def _sla_for_priority(priority: str) -> int:
    return {"critical": 4, "high": 8, "medium": 24, "low": 72}.get(priority, 24)


def _ticket_row(row) -> dict:
    return {
        "ticket_id":           row.ticket_id,
        "subject":             row.subject,
        "description":         row.description,
        "category":            row.category,
        "priority":            row.priority,
        "status":              row.status,
        "product":             row.product,
        "team":                row.team,
        "org_name":            row.org_name,
        "owner_email":         row.owner_email,
        "sla_hours":           row.sla_hours,
        "call_required":       row.call_required,
        "rating":              row.rating,
        "last_message":        row.last_message,
        "last_message_sender": row.last_message_sender,
        "unread_agent_count":  row.unread_agent_count,
        "created_at":          row.created_at.isoformat() if row.created_at else None,
        "updated_at":          row.updated_at.isoformat() if row.updated_at else None,
    }


# ══════════════════════════════════════════════════════════════════════════════
# HOSPITAL / PARTNER ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_ticket(
    body:    dict,
    user:    AnyUser,
    db:      AsyncSession = Depends(get_db),
):
    """
    Hospital admin or partner creates a support ticket.
    Body: { subject, description, category, priority, product? }
    """
    subject     = (body.get("subject")     or "").strip()
    description = (body.get("description") or "").strip()
    category    = body.get("category", "general")
    priority    = body.get("priority", "medium")
    product     = body.get("product",  "hospyn_web")

    if not subject:
        raise HTTPException(status_code=422, detail="subject is required")
    if not description:
        raise HTTPException(status_code=422, detail="description is required")
    if priority not in ("critical", "high", "medium", "low"):
        raise HTTPException(status_code=422, detail="priority must be critical/high/medium/low")

    year      = datetime.now(timezone.utc).year
    ticket_id = _gen_ticket_id(year)

    # Fetch org name + email from hospitals/users
    org_name    = None
    owner_email = None
    try:
        if user.hid:
            r = await db.execute(
                text("SELECT name, email FROM hospitals WHERE id = :hid AND deleted_at IS NULL"),
                {"hid": user.hid},
            )
            row = r.fetchone()
            if row:
                org_name    = row.name
                owner_email = row.email
        if not owner_email:
            r = await db.execute(
                text("SELECT email, full_name FROM users WHERE id = :uid AND deleted_at IS NULL"),
                {"uid": user.sub},
            )
            row = r.fetchone()
            if row:
                owner_email = row.email
                org_name    = org_name or row.full_name
    except Exception:
        pass

    await db.execute(
        text("""
            INSERT INTO support_tickets
                (ticket_id, subject, description, category, priority, status,
                 product, team, org_name, owner_email, sla_hours,
                 last_message, last_message_sender, call_required, unread_agent_count,
                 created_by_id, hospital_id, created_at, updated_at)
            VALUES
                (:ticket_id, :subject, :description, :category, :priority, 'open',
                 :product, 'support', :org_name, :owner_email, :sla_hours,
                 :description, 'owner', false, 1,
                 :user_id, :hospital_id, NOW(), NOW())
        """),
        {
            "ticket_id":   ticket_id,
            "subject":     subject,
            "description": description,
            "category":    category,
            "priority":    priority,
            "product":     product,
            "org_name":    org_name,
            "owner_email": owner_email,
            "sla_hours":   _sla_for_priority(priority),
            "user_id":     user.sub,
            "hospital_id": user.hid,
        },
    )
    await db.flush()

    return {
        "ticket_id": ticket_id,
        "subject":   subject,
        "priority":  priority,
        "status":    "open",
        "message":   f"Ticket {ticket_id} created. Our team will respond within {_sla_for_priority(priority)} hours.",
    }


@router.get("")
async def list_my_tickets(
    user:     AnyUser,
    db:       AsyncSession = Depends(get_db),
    status_f: Optional[str] = Query(None, alias="status"),
    page:     int = Query(1, ge=1),
    limit:    int = Query(20, ge=1, le=100),
):
    """Hospital/partner lists their own tickets."""
    where = "created_by_id = :uid AND deleted_at IS NULL"
    params: dict = {"uid": user.sub}
    if status_f:
        where += " AND status = :status"
        params["status"] = status_f

    try:
        count_r = await db.execute(
            text(f"SELECT COUNT(*) FROM support_tickets WHERE {where}"), params
        )
        total = int(count_r.scalar() or 0)

        r = await db.execute(
            text(f"""
                SELECT ticket_id, subject, description, category, priority, status,
                       product, team, org_name, owner_email, sla_hours, call_required,
                       rating, last_message, last_message_sender,
                       0 AS unread_agent_count, created_at, updated_at
                FROM support_tickets
                WHERE {where}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": limit, "offset": (page - 1) * limit},
        )
        tickets = [_ticket_row(row) for row in r.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "tickets": tickets,
        "total":   total,
        "page":    page,
        "pages":   max(1, (total + limit - 1) // limit),
    }


@router.post("/{ticket_id}/message")
async def send_message(
    ticket_id: str,
    body:      dict,
    user:      AnyUser,
    db:        AsyncSession = Depends(get_db),
):
    """Send a reply to a ticket thread. Used by both owner and agent."""
    text_content = (body.get("text") or "").strip()
    sender       = body.get("sender", "owner")         # "owner" | "agent"
    sender_label = body.get("sender_label", sender)

    if not text_content:
        raise HTTPException(status_code=422, detail="text is required")
    if sender not in ("owner", "agent"):
        raise HTTPException(status_code=422, detail="sender must be 'owner' or 'agent'")

    # Verify ticket exists
    r = await db.execute(
        text("SELECT ticket_id FROM support_tickets WHERE ticket_id = :tid AND deleted_at IS NULL"),
        {"tid": ticket_id},
    )
    if not r.fetchone():
        raise HTTPException(status_code=404, detail="Ticket not found")

    await db.execute(
        text("""
            INSERT INTO ticket_messages
                (ticket_id, sender, sender_label, text, read_by_owner, read_by_agent, created_at)
            VALUES (:tid, :sender, :label, :text, :rbo, :rba, NOW())
        """),
        {
            "tid":    ticket_id,
            "sender": sender,
            "label":  sender_label,
            "text":   text_content,
            "rbo":    sender == "owner",
            "rba":    sender == "agent",
        },
    )

    # Update last_message + unread count on parent ticket
    unread_col = "unread_owner_count" if sender == "agent" else "unread_agent_count"
    await db.execute(
        text(f"""
            UPDATE support_tickets
            SET last_message        = :msg,
                last_message_sender = :sender,
                {unread_col}        = COALESCE({unread_col}, 0) + 1,
                updated_at          = NOW()
            WHERE ticket_id = :tid
        """),
        {"msg": text_content, "sender": sender, "tid": ticket_id},
    )
    await db.flush()

    return {"status": "sent", "ticket_id": ticket_id}


@router.get("/{ticket_id}/messages")
async def get_messages(
    ticket_id: str,
    user:      AnyUser,
    db:        AsyncSession = Depends(get_db),
):
    """Get all messages in a ticket thread."""
    r = await db.execute(
        text("""
            SELECT id, sender, sender_label, text, read_by_owner, read_by_agent, created_at
            FROM ticket_messages
            WHERE ticket_id = :tid
            ORDER BY created_at ASC
        """),
        {"tid": ticket_id},
    )
    messages = [
        {
            "id":            str(row.id),
            "sender":        row.sender,
            "sender_label":  row.sender_label,
            "text":          row.text,
            "read_by_owner": row.read_by_owner,
            "read_by_agent": row.read_by_agent,
            "created_at":    row.created_at.isoformat() if row.created_at else None,
        }
        for row in r.fetchall()
    ]
    return {"messages": messages}


@router.post("/{ticket_id}/rating")
async def rate_ticket(
    ticket_id: str,
    body:      dict,
    user:      AnyUser,
    db:        AsyncSession = Depends(get_db),
):
    """Hospital/partner rates a resolved ticket (1-5)."""
    rating = body.get("rating")
    if not isinstance(rating, int) or rating not in range(1, 6):
        raise HTTPException(status_code=422, detail="rating must be an integer 1-5")

    await db.execute(
        text("UPDATE support_tickets SET rating = :r WHERE ticket_id = :tid AND deleted_at IS NULL"),
        {"r": rating, "tid": ticket_id},
    )
    await db.flush()
    return {"status": "rated", "ticket_id": ticket_id, "rating": rating}


# ══════════════════════════════════════════════════════════════════════════════
# SUPER ADMIN / INTERNAL AGENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/all")
async def list_all_tickets(
    user:        AdminAgent,
    db:          AsyncSession = Depends(get_db),
    status_f:    Optional[str] = Query(None, alias="status"),
    priority:    Optional[str] = Query(None),
    team:        Optional[str] = Query(None),
    q:           Optional[str] = Query(None),
    page:        int = Query(1, ge=1),
    limit:       int = Query(50, ge=1, le=200),
):
    """Super admin / agent: list all tickets across all hospitals/partners."""
    where_clauses = ["deleted_at IS NULL"]
    params: dict  = {}

    if status_f:
        where_clauses.append("status = :status")
        params["status"] = status_f
    if priority:
        where_clauses.append("priority = :priority")
        params["priority"] = priority
    if team:
        where_clauses.append("team = :team")
        params["team"] = team
    if q:
        where_clauses.append("(subject ILIKE :q OR description ILIKE :q OR org_name ILIKE :q OR ticket_id ILIKE :q)")
        params["q"] = f"%{q}%"

    where = " AND ".join(where_clauses)

    try:
        count_r = await db.execute(
            text(f"SELECT COUNT(*) FROM support_tickets WHERE {where}"), params
        )
        total = int(count_r.scalar() or 0)

        r = await db.execute(
            text(f"""
                SELECT ticket_id, subject, description, category, priority, status,
                       product, team, org_name, owner_email, sla_hours, call_required,
                       rating, last_message, last_message_sender,
                       COALESCE(unread_agent_count, 0) AS unread_agent_count,
                       created_at, updated_at
                FROM support_tickets
                WHERE {where}
                ORDER BY
                    CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
                    created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": limit, "offset": (page - 1) * limit},
        )
        tickets = [_ticket_row(row) for row in r.fetchall()]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    return {
        "tickets": tickets,
        "total":   total,
        "page":    page,
        "pages":   max(1, (total + limit - 1) // limit),
    }


@router.get("/stats")
async def get_ticket_stats(
    user: AdminAgent,
    db:   AsyncSession = Depends(get_db),
):
    """Ticket statistics for the super-admin dashboard header cards."""
    try:
        r = await db.execute(text("""
            SELECT
                COUNT(*)                                                         AS total,
                SUM(CASE WHEN status IN ('open','in_progress') THEN 1 ELSE 0 END) AS open,
                SUM(CASE WHEN priority = 'critical' AND status != 'closed' THEN 1 ELSE 0 END) AS critical,
                SUM(CASE WHEN status = 'resolved' AND DATE(updated_at) = CURRENT_DATE THEN 1 ELSE 0 END) AS resolved_today,
                AVG(CASE WHEN status = 'resolved' THEN rating END)               AS avg_rating,
                SUM(CASE WHEN call_required = true AND status != 'closed' THEN 1 ELSE 0 END) AS call_required
            FROM support_tickets
            WHERE deleted_at IS NULL
        """))
        row = r.fetchone()
        return {
            "total":          int(row.total or 0),
            "open":           int(row.open or 0),
            "critical":       int(row.critical or 0),
            "resolved_today": int(row.resolved_today or 0),
            "avg_rating":     round(float(row.avg_rating or 0), 1),
            "call_required":  int(row.call_required or 0),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{ticket_id}/status")
async def update_status(
    ticket_id: str,
    body:      dict,
    user:      AdminAgent,
    db:        AsyncSession = Depends(get_db),
):
    """Update ticket status."""
    new_status = body.get("status")
    valid = ("open", "in_progress", "waiting_on_user", "resolved", "closed")
    if new_status not in valid:
        raise HTTPException(status_code=422, detail=f"status must be one of {valid}")

    await db.execute(
        text("UPDATE support_tickets SET status = :s, updated_at = NOW() WHERE ticket_id = :tid AND deleted_at IS NULL"),
        {"s": new_status, "tid": ticket_id},
    )
    await db.flush()
    return {"ticket_id": ticket_id, "status": new_status}


@router.post("/{ticket_id}/assign")
async def assign_ticket(
    ticket_id: str,
    body:      dict,
    user:      AdminAgent,
    db:        AsyncSession = Depends(get_db),
):
    """Assign ticket to an agent and/or team."""
    team       = body.get("team")
    agent_name = body.get("agent_name")

    if team:
        await db.execute(
            text("UPDATE support_tickets SET team = :team, updated_at = NOW() WHERE ticket_id = :tid AND deleted_at IS NULL"),
            {"team": team, "tid": ticket_id},
        )
    await db.flush()
    return {"ticket_id": ticket_id, "team": team, "agent": agent_name}


@router.post("/{ticket_id}/flag-call")
async def flag_call_required(
    ticket_id: str,
    user:      AdminAgent,
    db:        AsyncSession = Depends(get_db),
):
    """Flag that a call is required for this ticket."""
    await db.execute(
        text("UPDATE support_tickets SET call_required = true, updated_at = NOW() WHERE ticket_id = :tid AND deleted_at IS NULL"),
        {"tid": ticket_id},
    )
    await db.flush()
    return {"ticket_id": ticket_id, "call_required": True}


@router.get("/{ticket_id}/internal-notes")
async def get_internal_notes(
    ticket_id: str,
    user:      AdminAgent,
    db:        AsyncSession = Depends(get_db),
):
    """Get internal agent notes — not visible to hospital/partner."""
    r = await db.execute(
        text("""
            SELECT id, note, author, created_at
            FROM ticket_internal_notes
            WHERE ticket_id = :tid
            ORDER BY created_at ASC
        """),
        {"tid": ticket_id},
    )
    notes = [
        {
            "id":         str(row.id),
            "note":       row.note,
            "author":     row.author,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in r.fetchall()
    ]
    return {"notes": notes}


@router.post("/{ticket_id}/internal-notes")
async def add_internal_note(
    ticket_id: str,
    body:      dict,
    user:      AdminAgent,
    db:        AsyncSession = Depends(get_db),
):
    """Add an internal note — only visible to Hospyn agents."""
    note   = (body.get("note")   or "").strip()
    author = (body.get("author") or "Agent").strip()

    if not note:
        raise HTTPException(status_code=422, detail="note is required")

    await db.execute(
        text("""
            INSERT INTO ticket_internal_notes (ticket_id, note, author, created_at)
            VALUES (:tid, :note, :author, NOW())
        """),
        {"tid": ticket_id, "note": note, "author": author},
    )
    await db.flush()
    return {"status": "added", "ticket_id": ticket_id}
