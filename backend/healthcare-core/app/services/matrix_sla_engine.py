"""
backend/healthcare-core/app/services/matrix_sla_engine.py

SLA Engine -- Modules 8 & 9

Two responsibilities:
  1. Background worker (run via asyncio task at startup):
       - Every 60s scans open tickets for SLA breaches
       - Marks breached, logs to matrix_sla_breaches
       - Triggers auto-escalation via the assignment engine
       - Publishes to Redis stream matrix:sla:breached for real-time UI

  2. FastAPI router (mounted at /matrix/sla):
       GET  /matrix/sla/rules          -- configurable SLA rules
       PUT  /matrix/sla/rules/{priority} -- update rule (super_admin only)
       GET  /matrix/sla/breaches       -- recent breaches (paginated)
       GET  /matrix/sla/risk           -- tickets at risk (approaching breach)
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, get_session_factory
from shared.redis_client import get_redis_client
from shared.utils.responses import success_response

logger = logging.getLogger(__name__)
router = APIRouter()

# Default SLA in minutes (also seeded in migration)
DEFAULT_SLA = {
    "critical": {"response": 15,  "resolution": 120,  "escalate_after": 15},
    "high":     {"response": 30,  "resolution": 240,  "escalate_after": 30},
    "medium":   {"response": 60,  "resolution": 720,  "escalate_after": 90},
    "low":      {"response": 240, "resolution": 1440, "escalate_after": 300},
}


# --- Background Worker --------------------------------------------------------

async def run_sla_worker():
    """
    Runs forever. Called from app lifespan as asyncio.create_task(run_sla_worker()).
    Checks every 60 seconds for SLA breaches across all open tickets.
    """
    logger.info("SLA Engine worker started")
    while True:
        try:
            await _check_sla_breaches()
        except Exception as e:
            logger.error("SLA worker error: %s", e)
        await asyncio.sleep(60)


async def _check_sla_breaches():
    """
    Core SLA check:
    1. Load SLA rules from DB (or defaults)
    2. Find tickets where sla_response_due or sla_resolution_due is past
    3. Log breach to matrix_sla_breaches
    4. Update ticket flags
    5. Trigger auto-escalation if configured
    6. Publish breach event to Redis stream
    """
    factory = get_session_factory()
    async with factory() as db:
        now = datetime.now(timezone.utc)

        # Fetch SLA rules
        rules_result = await db.execute(text("SELECT * FROM matrix_sla_rules"))
        rules = {r["priority"]: dict(r) for r in rules_result.mappings().all()} or DEFAULT_SLA

        # Find tickets with response SLA breach (first_response_at IS NULL and past due)
        resp_result = await db.execute(text("""
            SELECT ticket_id, priority, assigned_employee_id, created_at, sla_response_due
            FROM support_tickets
            WHERE status NOT IN ('resolved','closed')
              AND sla_response_breached = false
              AND first_response_at IS NULL
              AND sla_response_due IS NOT NULL
              AND sla_response_due < :now
        """), {"now": now})
        resp_breaches = [dict(r) for r in resp_result.mappings().all()]

        # Find tickets with resolution SLA breach
        res_result = await db.execute(text("""
            SELECT ticket_id, priority, assigned_employee_id, created_at, sla_resolution_due
            FROM support_tickets
            WHERE status NOT IN ('resolved','closed')
              AND sla_resolution_breached = false
              AND sla_resolution_due IS NOT NULL
              AND sla_resolution_due < :now
        """), {"now": now})
        res_breaches = [dict(r) for r in res_result.mappings().all()]

        for ticket in resp_breaches:
            overage = int((now - ticket["sla_response_due"]).total_seconds() / 60)
            await _log_breach(db, ticket["ticket_id"], "response", ticket["priority"], overage, ticket.get("assigned_employee_id"), now)
            await db.execute(text("""
                UPDATE support_tickets SET sla_response_breached = true, updated_at = :now
                WHERE ticket_id = :tid
            """), {"now": now, "tid": ticket["ticket_id"]})
            await _publish_breach_event(ticket["ticket_id"], "response", ticket["priority"], overage)
            rule = rules.get(ticket["priority"], DEFAULT_SLA.get(ticket["priority"], {}))
            if overage >= rule.get("escalate_after", 30):
                await _auto_escalate(db, ticket, now)

        for ticket in res_breaches:
            overage = int((now - ticket["sla_resolution_due"]).total_seconds() / 60)
            await _log_breach(db, ticket["ticket_id"], "resolution", ticket["priority"], overage, ticket.get("assigned_employee_id"), now)
            await db.execute(text("""
                UPDATE support_tickets SET sla_resolution_breached = true, updated_at = :now
                WHERE ticket_id = :tid
            """), {"now": now, "tid": ticket["ticket_id"]})
            await _publish_breach_event(ticket["ticket_id"], "resolution", ticket["priority"], overage)

        if resp_breaches or res_breaches:
            await db.commit()
            logger.info("SLA Engine: %d response breaches, %d resolution breaches processed",
                        len(resp_breaches), len(res_breaches))


async def _log_breach(db, ticket_id, breach_type, priority, overage, assigned_to, now):
    await db.execute(text("""
        INSERT INTO matrix_sla_breaches
          (id, ticket_id, breach_type, priority, overage_minutes, assigned_to, auto_escalated, created_at)
        VALUES
          (:id, :tid, :btype, :pri, :overage, :emp, false, :now)
        ON CONFLICT DO NOTHING
    """), {
        "id": str(uuid.uuid4()), "tid": ticket_id, "btype": breach_type,
        "pri": priority, "overage": overage, "emp": assigned_to, "now": now,
    })


async def _auto_escalate(db, ticket, now):
    """Escalate the ticket to the next level employee."""
    NEXT = {"l1": "team_lead", "team_lead": "manager", "manager": "super_admin"}
    curr_result = await db.execute(text("""
        SELECT t.escalation_level, e.team
        FROM support_tickets t
        LEFT JOIN hospyn_employees e ON e.employee_id = t.assigned_employee_id
        WHERE t.ticket_id = :tid
    """), {"tid": ticket["ticket_id"]})
    row = curr_result.mappings().first()
    if not row:
        return
    curr_level = row["escalation_level"] or "l1"
    next_level = NEXT.get(curr_level)
    if not next_level:
        return

    team = row["team"] or "support"
    target_result = await db.execute(text("""
        SELECT e.employee_id, e.full_name
        FROM hospyn_employees e
        LEFT JOIN support_tickets st ON st.assigned_employee_id = e.employee_id
          AND st.status NOT IN ('resolved','closed')
        WHERE e.team = :team AND e.level = :level AND e.is_active = true
          AND e.deleted_at IS NULL
        GROUP BY e.employee_id, e.full_name
        ORDER BY COUNT(st.ticket_id) ASC
        LIMIT 1
    """), {"team": team, "level": next_level})
    target = target_result.mappings().first()
    if not target:
        return

    await db.execute(text("""
        UPDATE support_tickets
        SET assigned_employee_id = :eid, assigned_employee_name = :ename,
            escalation_level = :level, updated_at = :now
        WHERE ticket_id = :tid
    """), {"eid": target["employee_id"], "ename": target["full_name"],
           "level": next_level, "now": now, "tid": ticket["ticket_id"]})

    await db.execute(text("""
        INSERT INTO ticket_assignments
          (id, ticket_id, from_employee_id, to_employee_id, action, note, created_at)
        VALUES (:id, :tid, :from_eid, :to_eid, 'escalated', :note, :now)
    """), {
        "id": str(uuid.uuid4()), "tid": ticket["ticket_id"],
        "from_eid": ticket.get("assigned_employee_id"),
        "to_eid": target["employee_id"],
        "note": f"Auto-escalated by SLA Engine: {next_level}",
        "now": now,
    })

    await db.execute(text("""
        UPDATE matrix_sla_breaches SET auto_escalated = true
        WHERE ticket_id = :tid ORDER BY created_at DESC LIMIT 1
    """), {"tid": ticket["ticket_id"]})
    logger.info("SLA auto-escalated %s -> %s %s", ticket["ticket_id"], next_level, target["employee_id"])


async def _publish_breach_event(ticket_id, breach_type, priority, overage):
    """Publish to Redis stream so the frontend real-time feed picks it up."""
    try:
        rc = get_redis_client()
        await rc.xadd("matrix:sla:breached", {
            "ticket_id":   ticket_id,
            "breach_type": breach_type,
            "priority":    priority,
            "overage_min": str(overage),
            "ts":          datetime.now(timezone.utc).isoformat(),
        }, maxlen=500)
    except Exception as e:
        logger.warning("SLA breach publish failed: %s", e)


# --- set SLA deadlines when a ticket is created -------------------------------

async def stamp_sla_deadlines(db: AsyncSession, ticket_id: str, priority: str, created_at: datetime):
    """
    Call this right after ticket insert to stamp response/resolution deadlines.
    Uses rules from DB if present, else DEFAULT_SLA.
    """
    rules_result = await db.execute(
        text("SELECT response_minutes, resolution_minutes FROM matrix_sla_rules WHERE priority = :p"),
        {"p": priority},
    )
    rule = rules_result.mappings().first()
    if rule:
        resp_min = rule["response_minutes"]
        res_min  = rule["resolution_minutes"]
    else:
        d = DEFAULT_SLA.get(priority, DEFAULT_SLA["medium"])
        resp_min = d["response"]
        res_min  = d["resolution"]

    resp_due = created_at + timedelta(minutes=resp_min)
    res_due  = created_at + timedelta(minutes=res_min)

    await db.execute(text("""
        UPDATE support_tickets
        SET sla_response_due = :resp_due, sla_resolution_due = :res_due
        WHERE ticket_id = :tid
    """), {"resp_due": resp_due, "res_due": res_due, "tid": ticket_id})


# --- API Router ---------------------------------------------------------------

@router.get("/rules")
async def get_sla_rules(db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM matrix_sla_rules ORDER BY response_minutes ASC"))
    rows = [dict(r) for r in result.mappings().all()]
    return success_response(data={"rules": rows or list(DEFAULT_SLA.values())})


class SLARuleUpdate(BaseModel):
    response_minutes:       int
    resolution_minutes:     int
    escalate_after_minutes: int


@router.put("/rules/{priority}")
async def update_sla_rule(priority: str, body: SLARuleUpdate, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    await db.execute(text("""
        INSERT INTO matrix_sla_rules (id, priority, response_minutes, resolution_minutes, escalate_after_minutes, updated_at)
        VALUES (gen_random_uuid(), :p, :r, :res, :esc, :now)
        ON CONFLICT (priority) DO UPDATE SET
            response_minutes = EXCLUDED.response_minutes,
            resolution_minutes = EXCLUDED.resolution_minutes,
            escalate_after_minutes = EXCLUDED.escalate_after_minutes,
            updated_at = EXCLUDED.updated_at
    """), {"p": priority, "r": body.response_minutes, "res": body.resolution_minutes, "esc": body.escalate_after_minutes, "now": now})
    await db.flush()
    return success_response(data={"updated": True, "priority": priority})


@router.get("/breaches")
async def get_breaches(
    priority: Optional[str] = Query(None),
    breach_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, le=200),
    db: AsyncSession = Depends(get_db),
):
    filters, params = ["1=1"], {"offset": (page-1)*limit, "limit": limit}
    if priority:
        filters.append("b.priority = :priority"); params["priority"] = priority
    if breach_type:
        filters.append("b.breach_type = :btype"); params["btype"] = breach_type
    where = " AND ".join(filters)

    result = await db.execute(text(f"""
        SELECT b.*,
               st.subject, st.status, st.team,
               e.full_name AS agent_name
        FROM matrix_sla_breaches b
        LEFT JOIN support_tickets st ON st.ticket_id = b.ticket_id
        LEFT JOIN hospyn_employees e ON e.employee_id = b.assigned_to
        WHERE {where}
        ORDER BY b.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params)
    rows = [dict(r) for r in result.mappings().all()]
    return success_response(data={"breaches": rows, "page": page, "limit": limit})


@router.get("/risk")
async def tickets_at_risk(db: AsyncSession = Depends(get_db)):
    """Tickets within 30 minutes of SLA breach (response or resolution)."""
    now    = datetime.now(timezone.utc)
    window = now + timedelta(minutes=30)
    result = await db.execute(text("""
        SELECT ticket_id, subject, priority, status, assigned_employee_id,
               sla_response_due, sla_resolution_due, team,
               LEAST(sla_response_due, sla_resolution_due) AS nearest_deadline
        FROM support_tickets
        WHERE status NOT IN ('resolved','closed')
          AND (
               (sla_response_due   BETWEEN :now AND :window AND sla_response_breached = false)
            OR (sla_resolution_due BETWEEN :now AND :window AND sla_resolution_breached = false)
          )
        ORDER BY nearest_deadline ASC
        LIMIT 100
    """), {"now": now, "window": window})
    rows = [dict(r) for r in result.mappings().all()]
    return success_response(data={"at_risk": rows, "count": len(rows), "window_minutes": 30})
