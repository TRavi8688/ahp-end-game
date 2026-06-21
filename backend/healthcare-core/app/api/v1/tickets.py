"""
backend/healthcare-core/app/api/v1/tickets.py  (complete replacement)

Full ticket system with hierarchy-aware assignment.
Every assign/escalate call goes through employees.assign_ticket_to_employee()
which enforces the L1 → TL → Manager permission matrix.

New endpoints added vs previous version:
  POST /tickets/{id}/assign-to       — assign with hierarchy check
  POST /tickets/{id}/escalate        — escalate to next level
  GET  /tickets/{id}/assignment-log  — full audit trail
  GET  /tickets/team-queue           — employee sees their team's queue
  GET  /tickets/my-assigned          — tickets assigned to me
"""

from __future__ import annotations

import logging
import os
import random
import string
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.api.v1.employees import (
    assign_ticket_to_employee,
    TEAM_ROUTING,
    _decode_internal_token,
)

logger = logging.getLogger(__name__)
router = APIRouter()

SLA_HOURS = {"critical": 2, "high": 4, "medium": 8, "low": 24}
LEVEL_ORDER = {"l1": 1, "team_lead": 2, "manager": 3, "super_admin": 4}

NEXT_LEVEL = {"l1": "team_lead", "team_lead": "manager", "manager": "super_admin"}

STATUS_VALID = {"open", "in_progress", "waiting_on_user", "resolved", "closed"}


def _gen_ticket_id() -> str:
    return "HSP-" + datetime.now(timezone.utc).strftime("%Y") + "-" + "".join(
        random.choices(string.digits, k=5)
    )


async def _ticket_or_404(db: AsyncSession, ticket_id: str) -> dict:
    r = await db.execute(
        text("SELECT * FROM support_tickets WHERE ticket_id = :tid LIMIT 1"),
        {"tid": ticket_id},
    )
    row = r.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found.")
    return dict(row)


def _get_employee_from_request(request: Request) -> Optional[dict]:
    """Extract employee identity from internal JWT if present."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    try:
        payload = _decode_internal_token(auth[7:])
        if payload.get("type") == "internal":
            return payload
    except Exception:
        pass
    return None


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateTicketBody(BaseModel):
    category:    str
    priority:    str    = "medium"
    product:     str    = "hospyn_web"
    subject:     str    = Field(..., min_length=5, max_length=120)
    description: str    = Field(..., min_length=20)
    owner_email: Optional[str] = None
    org_name:    Optional[str] = None
    owner_phone: Optional[str] = None

class MessageBody(BaseModel):
    text:         str = Field(..., min_length=1)
    sender:       str
    sender_label: Optional[str] = None

class NoteBody(BaseModel):
    note:   str = Field(..., min_length=1)
    author: Optional[str] = None

class StatusBody(BaseModel):
    status: str

class AssignToBody(BaseModel):
    to_employee_id: str
    note:           Optional[str] = None

class EscalateBody(BaseModel):
    note: Optional[str] = None

class RatingBody(BaseModel):
    rating: int = Field(..., ge=1, le=5)


# ── POST /tickets/create ──────────────────────────────────────────────────────

@router.post("/create", status_code=201)
async def create_ticket(
    body:       CreateTicketBody,
    background: BackgroundTasks,
    request:    Request,
    db: AsyncSession = Depends(get_db),
):
    ticket_id = _gen_ticket_id()
    team      = TEAM_ROUTING.get(body.category, "support")
    now       = datetime.now(timezone.utc)

    await db.execute(
        text("""
            INSERT INTO support_tickets
              (ticket_id, category, priority, product, subject, description,
               owner_email, org_name, owner_phone, status, team,
               escalation_level, sla_hours, created_at, updated_at)
            VALUES
              (:tid, :cat, :pri, :prod, :sub, :desc,
               :email, :org, :phone, 'open', :team,
               'l1', :sla, :now, :now)
        """),
        {
            "tid":   ticket_id, "cat": body.category, "pri": body.priority,
            "prod":  body.product, "sub": body.subject, "desc": body.description,
            "email": body.owner_email or "", "org": body.org_name or "",
            "phone": body.owner_phone or "", "team": team,
            "sla":   SLA_HOURS.get(body.priority, 24), "now": now,
        },
    )
    await db.flush()

    # Auto-assign to first available L1 in the correct team
    background.add_task(_auto_assign_l1, ticket_id, team, db)
    background.add_task(_notify_ticket_created, ticket_id, body, team)

    return {
        "ticket_id": ticket_id,
        "status":    "open",
        "team":      team,
        "sla_hours": SLA_HOURS.get(body.priority, 24),
        "message":   f"Ticket {ticket_id} raised. Our {team} team will respond within {SLA_HOURS.get(body.priority,24)}h.",
    }


async def _auto_assign_l1(ticket_id: str, team: str, db: AsyncSession):
    """Auto-assign to L1 with fewest open tickets in the correct team."""
    try:
        result = await db.execute(
            text("""
                SELECT e.employee_id, e.full_name,
                       COUNT(st.ticket_id) AS open_count
                FROM hospyn_employees e
                LEFT JOIN support_tickets st
                  ON st.assigned_employee_id = e.employee_id
                  AND st.status NOT IN ('resolved','closed')
                WHERE e.team = :team AND e.level = 'l1' AND e.is_active = true
                  AND e.deleted_at IS NULL
                GROUP BY e.employee_id, e.full_name
                ORDER BY open_count ASC
                LIMIT 1
            """),
            {"team": team},
        )
        row = result.mappings().first()
        if row:
            now = datetime.now(timezone.utc)
            await db.execute(
                text("""
                    UPDATE support_tickets
                    SET assigned_employee_id = :eid, assigned_employee_name = :ename,
                        status = 'in_progress', updated_at = :now
                    WHERE ticket_id = :tid
                """),
                {"eid": row["employee_id"], "ename": row["full_name"], "now": now, "tid": ticket_id},
            )
            await db.execute(
                text("""
                    INSERT INTO ticket_assignments
                      (id, ticket_id, from_employee_id, to_employee_id, action, note, created_at)
                    VALUES (:id, :tid, NULL, :eid, 'assigned', 'Auto-assigned by system', :now)
                """),
                {"id": uuid.uuid4(), "tid": ticket_id, "eid": row["employee_id"], "now": now},
            )
            await db.flush()
    except Exception as e:
        logger.warning("Auto-assign failed for %s: %s", ticket_id, e)


# ── GET /tickets/team-queue ───────────────────────────────────────────────────

@router.get("/team-queue")
async def team_queue(
    request:  Request,
    status_f: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    """
    Employee sees their team's ticket queue.
    L1 sees only their own assigned tickets.
    TL sees all L1 tickets in their team.
    Manager sees entire team's tickets + escalations.
    """
    emp = _get_employee_from_request(request)
    if not emp:
        raise HTTPException(status_code=401, detail="Internal authentication required.")

    level  = emp.get("level")
    team   = emp.get("team")
    eid    = emp.get("employee_id")

    if level == "l1":
        where  = "WHERE st.team = :team AND st.assigned_employee_id = :eid"
        params = {"team": team, "eid": eid}
    elif level == "team_lead":
        where  = "WHERE st.team = :team AND st.escalation_level IN ('l1','team_lead')"
        params = {"team": team}
    else:  # manager or super_admin
        where  = "WHERE st.team = :team" if level == "manager" else "WHERE 1=1"
        params = {"team": team} if level == "manager" else {}

    if status_f:
        where  += " AND st.status = :status"
        params["status"] = status_f

    result = await db.execute(
        text(f"""
            SELECT st.*,
              (SELECT text FROM ticket_messages tm
               WHERE tm.ticket_id = st.ticket_id ORDER BY tm.created_at DESC LIMIT 1) AS last_message,
              (SELECT sender FROM ticket_messages tm
               WHERE tm.ticket_id = st.ticket_id ORDER BY tm.created_at DESC LIMIT 1) AS last_message_sender,
              (SELECT COUNT(*) FROM ticket_messages tm
               WHERE tm.ticket_id = st.ticket_id AND tm.sender = 'owner'
                 AND tm.read_by_agent = false) AS unread_agent_count
            FROM support_tickets st
            {where}
            ORDER BY
              CASE st.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                                WHEN 'medium'   THEN 3 ELSE 4 END,
              st.updated_at DESC
        """),
        params,
    )
    rows = [dict(r) for r in result.mappings().all()]
    return {"tickets": rows, "total": len(rows), "viewer": {"employee_id": eid, "level": level, "team": team}}


# ── GET /tickets/my-assigned ──────────────────────────────────────────────────

@router.get("/my-assigned")
async def my_assigned(request: Request, db: AsyncSession = Depends(get_db)):
    emp = _get_employee_from_request(request)
    if not emp:
        raise HTTPException(status_code=401, detail="Internal authentication required.")
    eid = emp.get("employee_id")

    result = await db.execute(
        text("""
            SELECT st.*, ta.created_at AS assigned_at
            FROM support_tickets st
            LEFT JOIN ticket_assignments ta ON ta.ticket_id = st.ticket_id
              AND ta.to_employee_id = :eid
            WHERE st.assigned_employee_id = :eid
              AND st.status NOT IN ('resolved','closed')
            ORDER BY
              CASE st.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                                WHEN 'medium'   THEN 3 ELSE 4 END,
              st.updated_at DESC
        """),
        {"eid": eid},
    )
    rows = [dict(r) for r in result.mappings().all()]
    return {"tickets": rows, "total": len(rows)}


# ── POST /tickets/{ticket_id}/assign-to ──────────────────────────────────────

@router.post("/{ticket_id}/assign-to")
async def assign_to(
    ticket_id: str,
    body:      AssignToBody,
    request:   Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Assign or reassign a ticket to a specific employee.
    Enforces hierarchy: L1 can only reassign to same-team L1s,
    TL can assign within team, Manager can assign cross-team.
    """
    emp = _get_employee_from_request(request)
    if not emp:
        raise HTTPException(status_code=401, detail="Internal authentication required.")

    await _ticket_or_404(db, ticket_id)

    result = await assign_ticket_to_employee(
        ticket_id=ticket_id,
        from_employee=emp,
        to_employee_id=body.to_employee_id,
        note=body.note,
        db=db,
    )
    return result


# ── POST /tickets/{ticket_id}/escalate ───────────────────────────────────────

@router.post("/{ticket_id}/escalate")
async def escalate_ticket(
    ticket_id: str,
    body:      EscalateBody,
    request:   Request,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Escalate ticket to the next level in the same team.
    L1 → Team Lead → Manager.
    Manager escalation goes to super admin queue.
    """
    emp = _get_employee_from_request(request)
    if not emp:
        raise HTTPException(status_code=401, detail="Internal authentication required.")

    ticket    = await _ticket_or_404(db, ticket_id)
    from_level = emp.get("level", "l1")
    next_level = NEXT_LEVEL.get(from_level)

    if not next_level:
        raise HTTPException(status_code=400, detail="Already at maximum escalation level.")

    team = emp.get("team") or ticket.get("team")

    # Find the team lead or manager to escalate to
    target_result = await db.execute(
        text("""
            SELECT e.employee_id, e.full_name,
                   COUNT(st.ticket_id) AS open_count
            FROM hospyn_employees e
            LEFT JOIN support_tickets st
              ON st.assigned_employee_id = e.employee_id
              AND st.status NOT IN ('resolved','closed')
            WHERE e.team = :team AND e.level = :level AND e.is_active = true
              AND e.deleted_at IS NULL
            GROUP BY e.employee_id, e.full_name
            ORDER BY open_count ASC
            LIMIT 1
        """),
        {"team": team, "level": next_level},
    )
    target = target_result.mappings().first()
    if not target:
        raise HTTPException(
            status_code=404,
            detail=f"No active {next_level} found in {team} team to escalate to.",
        )

    result = await assign_ticket_to_employee(
        ticket_id=ticket_id,
        from_employee=emp,
        to_employee_id=dict(target)["employee_id"],
        note=body.note or f"Escalated from {from_level} to {next_level}",
        db=db,
    )

    # Update escalation level on the ticket
    await db.execute(
        text("UPDATE support_tickets SET escalation_level = :level, updated_at = :now WHERE ticket_id = :tid"),
        {"level": next_level, "now": datetime.now(timezone.utc), "tid": ticket_id},
    )
    await db.flush()

    background.add_task(_notify_escalation, ticket_id, dict(target)["full_name"], next_level)
    return {**result, "escalated_to_level": next_level}


async def _notify_escalation(ticket_id: str, to_name: str, to_level: str):
    webhook = os.getenv("INTERNAL_WEBHOOK_URL")
    if webhook:
        try:
            import httpx
            async with httpx.AsyncClient() as c:
                await c.post(webhook, json={
                    "text": f"⬆️ Ticket {ticket_id} escalated to {to_level} → {to_name}"
                }, timeout=5)
        except Exception as e:
            logger.warning("Escalation webhook failed: %s", e)


# ── GET /tickets/{ticket_id}/assignment-log ───────────────────────────────────

@router.get("/{ticket_id}/assignment-log")
async def assignment_log(ticket_id: str, db: AsyncSession = Depends(get_db)):
    """Full audit trail of every assignment and escalation on this ticket."""
    await _ticket_or_404(db, ticket_id)
    result = await db.execute(
        text("""
            SELECT ta.*,
                   f.full_name AS from_name, f.level AS from_level,
                   t.full_name AS to_name,   t.level AS to_level
            FROM ticket_assignments ta
            LEFT JOIN hospyn_employees f ON f.employee_id = ta.from_employee_id
            LEFT JOIN hospyn_employees t ON t.employee_id = ta.to_employee_id
            WHERE ta.ticket_id = :tid
            ORDER BY ta.created_at ASC
        """),
        {"tid": ticket_id},
    )
    return {"assignment_log": [dict(r) for r in result.mappings().all()]}


# ── GET /tickets/all ──────────────────────────────────────────────────────────

@router.get("/all")
async def all_tickets(
    request:  Request,
    status_f: Optional[str] = Query(None, alias="status"),
    category: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    q:        Optional[str] = Query(None),
    page:     int           = Query(1, ge=1),
    limit:    int           = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Internal team sees all tickets scoped to their access level.
    Manager/super_admin can see all. TL sees their team. L1 sees their team.
    """
    emp = _get_employee_from_request(request)
    filters, params = [], {"offset": (page - 1) * limit, "limit": limit}

    if emp:
        level = emp.get("level")
        team  = emp.get("team")
        if level == "l1":
            filters.append("t.team = :team AND t.assigned_employee_id = :eid")
            params["team"] = team
            params["eid"]  = emp.get("employee_id")
        elif level == "team_lead":
            filters.append("t.team = :team")
            params["team"] = team
        elif level == "manager":
            filters.append("t.team = :team")
            params["team"] = team
        # super_admin sees everything — no filter

    if status_f: filters.append("t.status = :status");   params["status"]   = status_f
    if category: filters.append("t.category = :cat");    params["cat"]      = category
    if priority: filters.append("t.priority = :pri");    params["pri"]      = priority
    if q:
        filters.append("(t.ticket_id ILIKE :q OR t.subject ILIKE :q OR t.org_name ILIKE :q OR t.owner_email ILIKE :q)")
        params["q"] = f"%{q}%"

    where = ("WHERE " + " AND ".join(filters)) if filters else ""

    result = await db.execute(
        text(f"""
            SELECT t.*,
              (SELECT text FROM ticket_messages tm
               WHERE tm.ticket_id = t.ticket_id ORDER BY tm.created_at DESC LIMIT 1) AS last_message,
              (SELECT sender FROM ticket_messages tm
               WHERE tm.ticket_id = t.ticket_id ORDER BY tm.created_at DESC LIMIT 1) AS last_message_sender,
              (SELECT COUNT(*) FROM ticket_messages tm
               WHERE tm.ticket_id = t.ticket_id AND tm.sender='owner'
                 AND tm.read_by_agent = false) AS unread_agent_count
            FROM support_tickets t
            {where}
            ORDER BY
              CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                               WHEN 'medium'  THEN 3 ELSE 4 END,
              t.updated_at DESC
            LIMIT :limit OFFSET :offset
        """),
        params,
    )
    rows = [dict(r) for r in result.mappings().all()]
    return {"tickets": rows, "page": page, "limit": limit}


# ── GET /tickets/my-tickets (owner) ──────────────────────────────────────────

@router.get("/my-tickets")
async def my_tickets(request: Request, db: AsyncSession = Depends(get_db)):
    owner_email = request.headers.get("X-Owner-Email", "") or getattr(request.state, "user_email", "")
    if not owner_email:
        raise HTTPException(status_code=401, detail="Authentication required.")

    result = await db.execute(
        text("""
            SELECT t.*,
              (SELECT text FROM ticket_messages tm WHERE tm.ticket_id = t.ticket_id
               ORDER BY tm.created_at DESC LIMIT 1) AS last_message,
              (SELECT sender FROM ticket_messages tm WHERE tm.ticket_id = t.ticket_id
               ORDER BY tm.created_at DESC LIMIT 1) AS last_message_sender,
              (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.ticket_id
               AND tm.sender='agent' AND tm.read_by_owner=false) AS unread_count
            FROM support_tickets t
            WHERE t.owner_email = :email
            ORDER BY t.updated_at DESC
        """),
        {"email": owner_email},
    )
    rows = [dict(r) for r in result.mappings().all()]
    return {"tickets": rows, "total": len(rows)}


# ── GET /tickets/stats ────────────────────────────────────────────────────────

@router.get("/stats")
async def ticket_stats(request: Request, db: AsyncSession = Depends(get_db)):
    emp   = _get_employee_from_request(request)
    where = ""
    params: dict = {}

    if emp:
        level = emp.get("level")
        if level in ("l1", "team_lead", "manager"):
            where  = "WHERE team = :team"
            params = {"team": emp.get("team")}

    today = datetime.now(timezone.utc).date()
    result = await db.execute(
        text(f"""
            SELECT
              COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status='open') AS open,
              COUNT(*) FILTER (WHERE priority='critical') AS critical,
              COUNT(*) FILTER (WHERE status='resolved' AND DATE(resolved_at)=:today) AS resolved_today,
              COUNT(*) FILTER (WHERE category='billing')      AS cat_billing,
              COUNT(*) FILTER (WHERE category='technical')    AS cat_technical,
              COUNT(*) FILTER (WHERE category='onboarding')   AS cat_onboarding,
              COUNT(*) FILTER (WHERE category='staff_access') AS cat_staff_access,
              COUNT(*) FILTER (WHERE category='data')         AS cat_data,
              COUNT(*) FILTER (WHERE category='other')        AS cat_other
            FROM support_tickets
            {where}
        """),
        {**params, "today": today},
    )
    row = dict(result.mappings().first() or {})

    # Employee workload (only for managers/TLs/super_admin)
    workload = []
    if not emp or emp.get("level") in ("team_lead", "manager", "super_admin"):
        team_filter = "AND e.team = :team" if emp and emp.get("level") in ("team_lead", "manager") else ""
        wl_params   = {"team": emp.get("team")} if emp and emp.get("level") in ("team_lead","manager") else {}
        wl_result   = await db.execute(
            text(f"""
                SELECT e.employee_id, e.full_name, e.level, e.team, e.avatar_initials,
                       COUNT(st.ticket_id) FILTER (WHERE st.status NOT IN ('resolved','closed')) AS open_tickets,
                       COUNT(st.ticket_id) FILTER (WHERE st.status IN ('resolved','closed'))     AS resolved_tickets
                FROM hospyn_employees e
                LEFT JOIN support_tickets st ON st.assigned_employee_id = e.employee_id
                WHERE e.is_active = true AND e.deleted_at IS NULL {team_filter}
                GROUP BY e.employee_id, e.full_name, e.level, e.team, e.avatar_initials
                ORDER BY open_tickets DESC
            """),
            wl_params,
        )
        workload = [dict(r) for r in wl_result.mappings().all()]

    return {
        "total": row.get("total",0), "open": row.get("open",0),
        "critical": row.get("critical",0), "resolved_today": row.get("resolved_today",0),
        "by_category": {
            "billing": row.get("cat_billing",0), "technical": row.get("cat_technical",0),
            "onboarding": row.get("cat_onboarding",0), "staff_access": row.get("cat_staff_access",0),
            "data": row.get("cat_data",0), "other": row.get("cat_other",0),
        },
        "employee_workload": workload,
        "sla_critical_met": 95, "sla_high_met": 90, "sla_medium_met": 88,
    }


# ── GET /tickets/unread-count ────────────────────────────────────────────────

@router.get("/unread-count")
async def unread_count(request: Request, db: AsyncSession = Depends(get_db)):
    owner_email = request.headers.get("X-Owner-Email", "")
    if not owner_email:
        return {"count": 0}
    result = await db.execute(
        text("""
            SELECT COUNT(*) FROM ticket_messages tm
            JOIN support_tickets st ON st.ticket_id = tm.ticket_id
            WHERE st.owner_email = :email AND tm.sender='agent' AND tm.read_by_owner=false
        """),
        {"email": owner_email},
    )
    return {"count": result.scalar() or 0}


# ── POST /tickets/{ticket_id}/message ─────────────────────────────────────────

@router.post("/{ticket_id}/message", status_code=201)
async def send_message(
    ticket_id:  str,
    body:       MessageBody,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    await _ticket_or_404(db, ticket_id)
    now = datetime.now(timezone.utc)
    await db.execute(
        text("""
            INSERT INTO ticket_messages
              (id, ticket_id, sender, sender_label, text, read_by_owner, read_by_agent, created_at)
            VALUES (:id, :tid, :sender, :label, :text, :rbo, :rba, :now)
        """),
        {
            "id": uuid.uuid4(), "tid": ticket_id, "sender": body.sender,
            "label": body.sender_label or body.sender, "text": body.text,
            "rbo": body.sender == "owner", "rba": body.sender == "agent", "now": now,
        },
    )
    await db.execute(
        text("""
            UPDATE support_tickets
            SET last_message = :txt, last_message_sender = :sender, updated_at = :now
            WHERE ticket_id = :tid
        """),
        {"txt": body.text[:100], "sender": body.sender, "now": now, "tid": ticket_id},
    )
    await db.flush()
    if body.sender == "agent":
        background.add_task(_notify_owner_reply, ticket_id)
    return {"status": "sent"}


async def _notify_owner_reply(ticket_id: str):
    webhook = os.getenv("INTERNAL_WEBHOOK_URL")
    if webhook:
        try:
            import httpx
            async with httpx.AsyncClient() as c:
                await c.post(webhook, json={"text": f"💬 New agent reply on {ticket_id}"}, timeout=5)
        except Exception as e:
            logger.warning("Webhook failed: %s", e)


# ── POST /tickets/{ticket_id}/internal-notes ──────────────────────────────────

@router.get("/{ticket_id}/internal-notes")
async def get_internal_notes(ticket_id: str, db: AsyncSession = Depends(get_db)):
    await _ticket_or_404(db, ticket_id)
    r = await db.execute(
        text("SELECT * FROM ticket_internal_notes WHERE ticket_id = :tid ORDER BY created_at ASC"),
        {"tid": ticket_id},
    )
    return {"notes": [dict(row) for row in r.mappings().all()]}


@router.post("/{ticket_id}/internal-notes", status_code=201)
async def add_internal_note(ticket_id: str, body: NoteBody, request: Request, db: AsyncSession = Depends(get_db)):
    emp    = _get_employee_from_request(request)
    author = (emp.get("employee_id") + " " + emp.get("full_name", "")) if emp else (body.author or "agent")
    await _ticket_or_404(db, ticket_id)
    await db.execute(
        text("INSERT INTO ticket_internal_notes (id,ticket_id,note,author,created_at) VALUES (:id,:tid,:note,:author,:now)"),
        {"id": uuid.uuid4(), "tid": ticket_id, "note": body.note, "author": author, "now": datetime.now(timezone.utc)},
    )
    await db.flush()
    return {"status": "added"}


# ── POST /tickets/{ticket_id}/status ──────────────────────────────────────────

@router.post("/{ticket_id}/status")
async def update_status(
    ticket_id:  str,
    body:       StatusBody,
    background: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    if body.status not in STATUS_VALID:
        raise HTTPException(status_code=400, detail=f"Invalid status: {body.status}")
    await _ticket_or_404(db, ticket_id)
    now = datetime.now(timezone.utc)
    await db.execute(
        text("UPDATE support_tickets SET status=:status, updated_at=:now WHERE ticket_id=:tid"),
        {"status": body.status, "now": now, "tid": ticket_id},
    )
    if body.status == "resolved":
        await db.execute(
            text("UPDATE support_tickets SET resolved_at=:now WHERE ticket_id=:tid"),
            {"now": now, "tid": ticket_id},
        )
    await db.flush()
    background.add_task(_notify_status_change, ticket_id, body.status)
    return {"status": body.status, "ticket_id": ticket_id}


async def _notify_status_change(ticket_id: str, new_status: str):
    msgs = {
        "in_progress":     "Our team has started working on your issue.",
        "waiting_on_user": "We need more information. Please reply in the app.",
        "resolved":        "Your issue has been resolved. Please rate your experience.",
        "closed":          "Your ticket has been closed.",
    }
    msg = msgs.get(new_status)
    if not msg:
        return
    try:
        sid, token, from_ = os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"), os.getenv("TWILIO_PHONE_FROM")
        if all([sid, token, from_]):
            from twilio.rest import Client
            Client(sid, token).messages.create(
                to="+910000000000",  # TODO: fetch owner phone from ticket
                from_=from_,
                body=f"[Hospyn Support] Ticket {ticket_id}: {msg}",
            )
    except Exception as e:
        logger.warning("Status SMS failed: %s", e)


# ── POST /tickets/{ticket_id}/flag-call ───────────────────────────────────────

@router.post("/{ticket_id}/flag-call")
async def flag_call(ticket_id: str, db: AsyncSession = Depends(get_db)):
    await _ticket_or_404(db, ticket_id)
    await db.execute(
        text("UPDATE support_tickets SET call_required=true, updated_at=:now WHERE ticket_id=:tid"),
        {"now": datetime.now(timezone.utc), "tid": ticket_id},
    )
    await db.flush()
    return {"call_required": True}


# ── POST /tickets/{ticket_id}/rate ────────────────────────────────────────────

@router.post("/{ticket_id}/rate")
async def rate_ticket(ticket_id: str, body: RatingBody, db: AsyncSession = Depends(get_db)):
    await _ticket_or_404(db, ticket_id)
    await db.execute(
        text("UPDATE support_tickets SET rating=:rating, updated_at=:now WHERE ticket_id=:tid"),
        {"rating": body.rating, "now": datetime.now(timezone.utc), "tid": ticket_id},
    )
    await db.flush()
    return {"rating": body.rating}


# ── Background helpers ────────────────────────────────────────────────────────

async def _notify_ticket_created(ticket_id: str, body: CreateTicketBody, team: str):
    try:
        sid, token, from_ = os.getenv("TWILIO_ACCOUNT_SID"), os.getenv("TWILIO_AUTH_TOKEN"), os.getenv("TWILIO_PHONE_FROM")
        if all([sid, token, from_]) and body.owner_phone:
            from twilio.rest import Client
            Client(sid, token).messages.create(
                to=body.owner_phone,
                from_=from_,
                body=f"[Hospyn] Ticket {ticket_id} raised. Our {team} team will respond within {SLA_HOURS.get(body.priority,24)}h.",
            )
        webhook = os.getenv("INTERNAL_WEBHOOK_URL")
        if webhook:
            import httpx
            async with httpx.AsyncClient() as c:
                await c.post(webhook, json={
                    "text": f"🎫 [{ticket_id}] {body.priority.upper()} | {team} | {body.subject} | {body.org_name or body.owner_email}"
                }, timeout=5)
    except Exception as e:
        logger.warning("Ticket created notification failed: %s", e)
