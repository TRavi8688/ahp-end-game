"""
backend/healthcare-core/app/api/v1/matrix_ops.py

Operations APIs — Modules 5-7, 12, 13, 14, 15, 16, 17, 18, 19, 20

Mounted at /matrix:

  /matrix/employees          — shift management, workload
  /matrix/incidents          — incident war room
  /matrix/broadcasts         — emergency broadcast
  /matrix/iam                — identity & access management
  /matrix/verification       — verification command
  /matrix/financial          — financial command
  /matrix/audit              — audit & compliance
  /matrix/ai                 — AI copilot query log
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from shared.utils.responses import success_response
from shared.redis_client import get_redis_client

logger  = logging.getLogger(__name__)
router  = APIRouter()


# ════════════════════════════════════════════════════════════════════
# MODULE 5-7: EMPLOYEE SHIFT MANAGEMENT & WORKLOAD BALANCER
# ════════════════════════════════════════════════════════════════════

VALID_SHIFTS = {"online", "offline", "break", "meeting", "training", "leave"}

class ShiftUpdateBody(BaseModel):
    shift_status: str
    reason: Optional[str] = None


@router.get("/employees")
async def list_employees(
    team:   Optional[str] = Query(None),
    level:  Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """All employees with live open ticket counts and shift status."""
    filters, params = ["e.deleted_at IS NULL"], {}
    if team:   filters.append("e.team = :team");      params["team"]   = team
    if level:  filters.append("e.level = :level");    params["level"]  = level
    if status: filters.append("e.shift_status = :s"); params["s"]      = status

    result = await db.execute(text(f"""
        SELECT
            e.*,
            COUNT(st.ticket_id) FILTER (WHERE st.status NOT IN ('resolved','closed')) AS open_tickets,
            COUNT(st.ticket_id) FILTER (WHERE st.status IN ('resolved','closed'))     AS resolved_total,
            ROUND(
                100.0 * COUNT(st.ticket_id) FILTER (WHERE st.status = 'resolved')
                / NULLIF(COUNT(st.ticket_id),0), 1
            ) AS resolution_rate
        FROM hospyn_employees e
        LEFT JOIN support_tickets st ON st.assigned_employee_id = e.employee_id
        WHERE {" AND ".join(filters)}
        GROUP BY e.id, e.employee_id, e.full_name, e.email, e.team, e.level,
                 e.shift_status, e.is_active, e.avatar_initials, e.phone,
                 e.daily_ticket_limit, e.last_seen_at, e.created_at, e.updated_at
        ORDER BY e.team, open_tickets DESC
    """), params)
    rows = [dict(r) for r in result.mappings().all()]
    return success_response(data={"employees": rows, "total": len(rows)})


@router.patch("/employees/{employee_id}/shift")
async def update_shift(
    employee_id: str,
    body: ShiftUpdateBody,
    db: AsyncSession = Depends(get_db),
):
    """
    Change an employee's shift status.
    If going to leave/offline, triggers ticket redistribution.
    """
    if body.shift_status not in VALID_SHIFTS:
        raise HTTPException(400, f"Invalid shift_status. Must be one of: {VALID_SHIFTS}")

    # Fetch current status
    curr = await db.execute(
        text("SELECT shift_status, team, level FROM hospyn_employees WHERE employee_id = :eid AND deleted_at IS NULL"),
        {"eid": employee_id},
    )
    emp = curr.mappings().first()
    if not emp:
        raise HTTPException(404, f"Employee {employee_id} not found")

    from_status = emp["shift_status"]
    now = datetime.now(timezone.utc)

    # Update shift
    await db.execute(text("""
        UPDATE hospyn_employees
        SET shift_status = :status, last_seen_at = :now, updated_at = :now
        WHERE employee_id = :eid
    """), {"status": body.shift_status, "now": now, "eid": employee_id})

    # Log shift change
    await db.execute(text("""
        INSERT INTO matrix_shift_log
          (id, employee_id, from_status, to_status, reason, tickets_redistributed, created_at)
        VALUES (:id, :eid, :from_s, :to_s, :reason, 0, :now)
    """), {
        "id": str(uuid.uuid4()), "eid": employee_id,
        "from_s": from_status, "to_s": body.shift_status,
        "reason": body.reason, "now": now,
    })

    redistributed = 0
    # Auto-redistribute tickets if going unavailable
    if body.shift_status in ("leave", "offline") and from_status in ("online", "break", "meeting"):
        redistributed = await _redistribute_tickets(db, employee_id, emp["team"], now)

    await db.commit()

    # Publish shift event to Redis for real-time feed
    try:
        rc = get_redis_client()
        await rc.xadd("matrix:shifts", {
            "employee_id": employee_id, "from": from_status, "to": body.shift_status,
            "tickets_moved": str(redistributed), "ts": now.isoformat(),
        }, maxlen=200)
    except Exception:
        pass

    return success_response(data={
        "employee_id": employee_id, "from_status": from_status,
        "to_status": body.shift_status, "tickets_redistributed": redistributed,
    })


async def _redistribute_tickets(db: AsyncSession, from_eid: str, team: str, now: datetime) -> int:
    """
    Move all open tickets from departing employee to available agents,
    distributing by lowest current workload.
    Returns count of tickets moved.
    """
    open_result = await db.execute(text("""
        SELECT ticket_id, priority
        FROM support_tickets
        WHERE assigned_employee_id = :eid AND status NOT IN ('resolved','closed')
        ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
    """), {"eid": from_eid})
    tickets = [dict(r) for r in open_result.mappings().all()]

    if not tickets:
        return 0

    for ticket in tickets:
        # Find available agent with lowest load
        avail = await db.execute(text("""
            SELECT e.employee_id, e.full_name, COUNT(st.ticket_id) AS load
            FROM hospyn_employees e
            LEFT JOIN support_tickets st ON st.assigned_employee_id = e.employee_id
              AND st.status NOT IN ('resolved','closed')
            WHERE e.team = :team AND e.level = 'l1'
              AND e.is_active = true AND e.deleted_at IS NULL
              AND e.shift_status = 'online'
              AND e.employee_id != :from_eid
            GROUP BY e.employee_id, e.full_name
            ORDER BY load ASC
            LIMIT 1
        """), {"team": team, "from_eid": from_eid})
        target = avail.mappings().first()
        if not target:
            break
        await db.execute(text("""
            UPDATE support_tickets
            SET assigned_employee_id = :eid, assigned_employee_name = :ename, updated_at = :now
            WHERE ticket_id = :tid
        """), {"eid": target["employee_id"], "ename": target["full_name"], "now": now, "tid": ticket["ticket_id"]})
        await db.execute(text("""
            INSERT INTO ticket_assignments
              (id, ticket_id, from_employee_id, to_employee_id, action, note, created_at)
            VALUES (:id, :tid, :from_eid, :to_eid, 'reassigned', 'Auto-redistributed: agent unavailable', :now)
        """), {"id": str(uuid.uuid4()), "tid": ticket["ticket_id"], "from_eid": from_eid,
               "to_eid": target["employee_id"], "now": now})

    await db.execute(text("""
        UPDATE matrix_shift_log SET tickets_redistributed = :count
        WHERE employee_id = :eid ORDER BY created_at DESC LIMIT 1
    """), {"count": len(tickets), "eid": from_eid})
    return len(tickets)


@router.get("/employees/{employee_id}/workload")
async def employee_workload(employee_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT
            e.employee_id, e.full_name, e.team, e.level, e.shift_status,
            e.daily_ticket_limit,
            COUNT(st.ticket_id) FILTER (WHERE st.status NOT IN ('resolved','closed')) AS open_tickets,
            COUNT(st.ticket_id) FILTER (WHERE st.priority = 'critical'
                AND st.status NOT IN ('resolved','closed')) AS critical_open,
            COUNT(st.ticket_id) FILTER (WHERE st.status = 'resolved'
                AND DATE(st.resolved_at) = CURRENT_DATE) AS resolved_today
        FROM hospyn_employees e
        LEFT JOIN support_tickets st ON st.assigned_employee_id = e.employee_id
        WHERE e.employee_id = :eid AND e.deleted_at IS NULL
        GROUP BY e.id, e.employee_id, e.full_name, e.team, e.level, e.shift_status, e.daily_ticket_limit
    """), {"eid": employee_id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(404, "Employee not found")
    return success_response(data=dict(row))


# ════════════════════════════════════════════════════════════════════
# MODULE 15: INCIDENT WAR ROOM
# ════════════════════════════════════════════════════════════════════

class IncidentCreateBody(BaseModel):
    title:        str
    severity:     str = "P3"
    team:         str = "engineering"
    affected_count: Optional[str] = None
    owner_employee_id: Optional[str] = None

class IncidentUpdateBody(BaseModel):
    status:       Optional[str] = None
    root_cause:   Optional[str] = None
    resolution:   Optional[str] = None

class TimelineEntryBody(BaseModel):
    entry_type: str   # alert | action | finding | resolution
    message:    str
    author:     Optional[str] = None


@router.get("/incidents")
async def list_incidents(
    status:   Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    filters, params = ["1=1"], {}
    if status:   filters.append("status = :status");   params["status"]   = status
    if severity: filters.append("severity = :sev");    params["sev"]      = severity

    result = await db.execute(text(f"""
        SELECT i.*,
               (SELECT COUNT(*) FROM matrix_incident_timeline t WHERE t.incident_id = i.incident_id) AS timeline_count
        FROM matrix_incidents i
        WHERE {" AND ".join(filters)}
        ORDER BY CASE i.severity WHEN 'P1' THEN 1 WHEN 'P2' THEN 2 WHEN 'P3' THEN 3 ELSE 4 END,
                 i.created_at DESC
    """), params)
    rows = [dict(r) for r in result.mappings().all()]
    return success_response(data={"incidents": rows, "total": len(rows)})


@router.post("/incidents", status_code=201)
async def create_incident(body: IncidentCreateBody, db: AsyncSession = Depends(get_db)):
    now = datetime.now(timezone.utc)
    result = await db.execute(text("""
        SELECT COUNT(*) AS n FROM matrix_incidents
    """))
    n = (result.scalar() or 0) + 1
    incident_id = f"INC-{n:04d}"

    await db.execute(text("""
        INSERT INTO matrix_incidents
          (id, incident_id, title, severity, status, team, affected_count, owner_employee_id, created_at)
        VALUES
          (gen_random_uuid(), :iid, :title, :sev, 'active', :team, :affected, :owner, :now)
    """), {
        "iid": incident_id, "title": body.title, "sev": body.severity,
        "team": body.team, "affected": body.affected_count,
        "owner": body.owner_employee_id, "now": now,
    })
    # Auto-add first timeline entry
    await db.execute(text("""
        INSERT INTO matrix_incident_timeline
          (id, incident_id, entry_type, message, author, created_at)
        VALUES (gen_random_uuid(), :iid, 'action', 'Incident declared', 'System', :now)
    """), {"iid": incident_id, "now": now})
    await db.commit()

    # Publish to Redis for real-time dashboard
    try:
        rc = get_redis_client()
        await rc.xadd("matrix:incidents", {
            "incident_id": incident_id, "severity": body.severity, "title": body.title,
            "ts": now.isoformat(),
        }, maxlen=100)
    except Exception:
        pass

    return success_response(data={"incident_id": incident_id, "status": "active"})


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT * FROM matrix_incidents WHERE incident_id = :iid"),
        {"iid": incident_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(404, f"Incident {incident_id} not found")

    timeline = await db.execute(
        text("SELECT * FROM matrix_incident_timeline WHERE incident_id = :iid ORDER BY created_at ASC"),
        {"iid": incident_id},
    )
    return success_response(data={
        "incident": dict(row),
        "timeline": [dict(r) for r in timeline.mappings().all()],
    })


@router.patch("/incidents/{incident_id}")
async def update_incident(incident_id: str, body: IncidentUpdateBody, db: AsyncSession = Depends(get_db)):
    updates, params = [], {"iid": incident_id, "now": datetime.now(timezone.utc)}
    if body.status:     updates.append("status = :status");         params["status"]    = body.status
    if body.root_cause: updates.append("root_cause = :root_cause"); params["root_cause"]= body.root_cause
    if body.resolution: updates.append("resolution = :resolution"); params["resolution"]= body.resolution
    if body.status == "resolved":
        updates.append("resolved_at = :now")
    elif body.status == "mitigated":
        updates.append("mitigated_at = :now")
    if not updates:
        raise HTTPException(400, "Nothing to update")
    await db.execute(
        text(f"UPDATE matrix_incidents SET {', '.join(updates)} WHERE incident_id = :iid"),
        params,
    )
    await db.commit()
    return success_response(data={"updated": True})


@router.post("/incidents/{incident_id}/timeline", status_code=201)
async def add_timeline_entry(incident_id: str, body: TimelineEntryBody, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO matrix_incident_timeline
          (id, incident_id, entry_type, message, author, created_at)
        VALUES (gen_random_uuid(), :iid, :type, :msg, :author, :now)
    """), {"iid": incident_id, "type": body.entry_type,
           "msg": body.message, "author": body.author, "now": datetime.now(timezone.utc)})
    await db.commit()
    return success_response(data={"added": True})


# ════════════════════════════════════════════════════════════════════
# MODULE 19: EMERGENCY BROADCAST
# ════════════════════════════════════════════════════════════════════

class BroadcastBody(BaseModel):
    title:    str
    body:     str
    targets:  List[str]   # e.g. ["hospitals", "pharmacies", "all_patients"]
    channels: List[str]   # e.g. ["whatsapp", "sms", "push"]
    sent_by:  Optional[str] = None


@router.post("/broadcasts", status_code=201)
async def send_broadcast(payload: BroadcastBody, db: AsyncSession = Depends(get_db)):
    """
    Save broadcast record. Actual delivery dispatched via event bus workers.
    Estimated reach_count calculated from targets.
    """
    now = datetime.now(timezone.utc)

    # Estimate reach
    reach = await _estimate_reach(db, payload.targets)

    await db.execute(text("""
        INSERT INTO matrix_broadcasts
          (id, title, body, targets, channels, reach_count, sent_by, sent_at)
        VALUES
          (gen_random_uuid(), :title, :body, :targets, :channels, :reach, :sent_by, :now)
    """), {
        "title": payload.title, "body": payload.body,
        "targets": payload.targets, "channels": payload.channels,
        "reach": reach, "sent_by": payload.sent_by, "now": now,
    })
    await db.commit()

    # Publish to event bus for delivery workers
    try:
        from shared.utils.event_bus import EventBus
        await EventBus.publish("matrix:broadcasts", {
            "title": payload.title, "body": payload.body,
            "targets": payload.targets, "channels": payload.channels,
        })
    except Exception as e:
        logger.warning("Broadcast event publish failed: %s", e)

    return success_response(data={"sent": True, "estimated_reach": reach})


async def _estimate_reach(db: AsyncSession, targets: list) -> int:
    total = 0
    for t in targets:
        if t in ("all_hospitals", "hospitals"):
            r = await db.execute(text("SELECT COUNT(*) FROM hospitals WHERE status='active' AND deleted_at IS NULL"))
            total += r.scalar() or 0
        elif t in ("all_pharmacies", "pharmacies"):
            r = await db.execute(text("SELECT COUNT(*) FROM pharmacies WHERE is_active=true AND deleted_at IS NULL"))
            total += r.scalar() or 0
        elif t in ("all_patients", "patients"):
            r = await db.execute(text("SELECT COUNT(*) FROM patients WHERE deleted_at IS NULL"))
            total += r.scalar() or 0
        elif t == "all_employees":
            r = await db.execute(text("SELECT COUNT(*) FROM hospyn_employees WHERE is_active=true AND deleted_at IS NULL"))
            total += r.scalar() or 0
    return total


@router.get("/broadcasts")
async def list_broadcasts(
    page: int = Query(1, ge=1),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(text("""
        SELECT * FROM matrix_broadcasts
        ORDER BY sent_at DESC
        LIMIT :limit OFFSET :offset
    """), {"limit": limit, "offset": (page-1)*limit})
    rows = [dict(r) for r in result.mappings().all()]
    return success_response(data={"broadcasts": rows, "page": page})


# ════════════════════════════════════════════════════════════════════
# MODULE 16: IAM GOVERNANCE
# ════════════════════════════════════════════════════════════════════

class UserActionBody(BaseModel):
    action:  str    # suspend | activate | force_logout | reset_password | assign_role
    reason:  Optional[str] = None
    new_role: Optional[str] = None


@router.get("/iam/search")
async def iam_search(
    q: str = Query(..., min_length=2),
    entity_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Global identity search: patients, employees, hospitals, pharmacies, labs.
    Returns unified result list with entity_type discriminator.
    """
    like = f"%{q}%"
    results = []

    if not entity_type or entity_type == "employee":
        r = await db.execute(text("""
            SELECT 'employee' AS entity_type, employee_id AS id,
                   full_name AS name, email, team AS org, level AS role,
                   is_active, shift_status AS status
            FROM hospyn_employees
            WHERE (full_name ILIKE :q OR email ILIKE :q OR employee_id ILIKE :q)
              AND deleted_at IS NULL
            LIMIT 10
        """), {"q": like})
        results.extend([dict(row) for row in r.mappings().all()])

    if not entity_type or entity_type == "hospital":
        r = await db.execute(text("""
            SELECT 'hospital' AS entity_type, id::text AS id,
                   name, email, city AS org, 'hospital_admin' AS role,
                   is_active, status::text AS status
            FROM hospitals
            WHERE (name ILIKE :q OR email ILIKE :q OR registration_number ILIKE :q)
              AND deleted_at IS NULL
            LIMIT 10
        """), {"q": like})
        results.extend([dict(row) for row in r.mappings().all()])

    if not entity_type or entity_type == "patient":
        r = await db.execute(text("""
            SELECT 'patient' AS entity_type, id::text AS id,
                   full_name AS name, '' AS email, '' AS org, 'patient' AS role,
                   true AS is_active, 'active' AS status
            FROM patients
            WHERE full_name ILIKE :q
              AND deleted_at IS NULL
            LIMIT 10
        """), {"q": like})
        results.extend([dict(row) for row in r.mappings().all()])

    return success_response(data={"results": results, "total": len(results)})


@router.post("/iam/{entity_type}/{entity_id}/action")
async def iam_action(
    entity_type: str,
    entity_id:   str,
    body: UserActionBody,
    db: AsyncSession = Depends(get_db),
):
    """
    Perform IAM action: suspend, activate, force_logout, reset_password.
    All actions are logged to audit_logs.
    """
    now    = datetime.now(timezone.utc)
    action = body.action

    if entity_type == "employee":
        if action == "suspend":
            await db.execute(text("UPDATE hospyn_employees SET is_active=false, updated_at=:now WHERE employee_id=:id"),
                             {"now": now, "id": entity_id})
        elif action == "activate":
            await db.execute(text("UPDATE hospyn_employees SET is_active=true, updated_at=:now WHERE employee_id=:id"),
                             {"now": now, "id": entity_id})
        elif action == "force_logout":
            try:
                from shared.redis_client import get_redis_client
                rc = get_redis_client()
                await rc.set(f"force_logout:{entity_id}", "1", ex=3600)
            except Exception as e:
                logger.warning("Force logout redis: %s", e)

    elif entity_type == "hospital":
        if action == "suspend":
            await db.execute(text("UPDATE hospitals SET status='suspended', updated_at=:now WHERE id=:id::uuid"),
                             {"now": now, "id": entity_id})
        elif action == "activate":
            await db.execute(text("UPDATE hospitals SET status='active', is_active=true, updated_at=:now WHERE id=:id::uuid"),
                             {"now": now, "id": entity_id})

    # Log to audit_logs
    await db.execute(text("""
        INSERT INTO audit_logs
          (id, action, entity_type, entity_id, details, created_at)
        VALUES
          (gen_random_uuid(), :action, :etype, :eid::uuid, :details, :now)
    """), {
        "action": f"iam_{action}", "etype": entity_type,
        "eid": entity_id,
        "details": json.dumps({"reason": body.reason, "new_role": body.new_role}),
        "now": now,
    })
    await db.commit()
    return success_response(data={"action": action, "entity_id": entity_id, "applied_at": now.isoformat()})


# ════════════════════════════════════════════════════════════════════
# MODULE 17: VERIFICATION COMMAND
# ════════════════════════════════════════════════════════════════════

@router.get("/verification/queue")
async def verification_queue(
    entity_type: Optional[str] = Query(None),
    status:      Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Unified verification queue for hospitals, pharmacies, labs, employees."""
    filters, params = ["1=1"], {}
    if status:      filters.append("h.status = :status"); params["status"] = status
    elif not status: filters.append("h.status IN ('pending_verification','active','suspended')")
    if entity_type and entity_type == "hospital":
        pass  # already querying hospitals
    where = " AND ".join(filters)

    result = await db.execute(text(f"""
        SELECT
            h.id::text AS id,
            'hospital' AS entity_type,
            h.name,
            h.email,
            h.city,
            h.status::text AS verification_status,
            h.created_at AS submitted_at,
            h.verified_at,
            h.verified_by,
            (SELECT COUNT(*) FROM hospital_documents hd WHERE hd.hospital_id = h.id) AS doc_count,
            (SELECT COUNT(*) FROM fraud_signals fs WHERE fs.hospital_id = h.id) AS fraud_signals
        FROM hospitals h
        WHERE {where}
        ORDER BY
            CASE h.status WHEN 'pending_verification' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
            h.created_at DESC
        LIMIT 100
    """), params)
    rows = [dict(r) for r in result.mappings().all()]
    return success_response(data={"queue": rows, "total": len(rows)})


class VerificationActionBody(BaseModel):
    action:   str   # approve | reject | request_more_info
    reason:   Optional[str] = None
    reviewer: Optional[str] = None


@router.post("/verification/{entity_type}/{entity_id}/action")
async def verification_action(
    entity_type: str,
    entity_id:   str,
    body: VerificationActionBody,
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    if entity_type == "hospital":
        new_status = "active" if body.action == "approve" else ("suspended" if body.action == "reject" else "pending_verification")
        await db.execute(text("""
            UPDATE hospitals
            SET status = :status, is_active = :active,
                verified_at = :vat, verified_by = :vby, updated_at = :now
            WHERE id = :eid::uuid
        """), {
            "status": new_status, "active": body.action == "approve",
            "vat": now if body.action == "approve" else None,
            "vby": body.reviewer, "now": now, "eid": entity_id,
        })

    await db.execute(text("""
        INSERT INTO audit_logs (id, action, entity_type, entity_id, details, created_at)
        VALUES (gen_random_uuid(), :action, :etype, :eid::uuid, :details, :now)
    """), {
        "action": f"verification_{body.action}", "etype": entity_type,
        "eid": entity_id,
        "details": json.dumps({"reason": body.reason, "reviewer": body.reviewer}),
        "now": now,
    })
    await db.commit()
    return success_response(data={"action": body.action, "entity_id": entity_id})


# ════════════════════════════════════════════════════════════════════
# MODULE 18: FINANCIAL COMMAND
# ════════════════════════════════════════════════════════════════════

@router.get("/financial/overview")
async def financial_overview(db: AsyncSession = Depends(get_db)):
    now         = datetime.now(timezone.utc)
    today       = now.date()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(text("""
        SELECT
            COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = :today AND status='success'), 0)          AS revenue_today,
            COALESCE(SUM(amount) FILTER (WHERE created_at >= :month_start AND status='success'), 0)          AS revenue_month,
            COUNT(*) FILTER (WHERE status='failed' AND created_at >= :hour_ago)                              AS failed_hour,
            COUNT(*) FILTER (WHERE status='refunded' AND created_at >= :month_start)                         AS refunds_month,
            COALESCE(SUM(amount) FILTER (WHERE status='refunded' AND created_at >= :month_start), 0)         AS refund_amount_month
        FROM payment_transactions
    """), {"today": today, "month_start": month_start, "hour_ago": now.replace(minute=now.minute - 60 if now.minute >= 60 else 0)})
    row = dict(result.mappings().first() or {})

    # Revenue by source (hospital / pharmacy / lab via billing context)
    src_result = await db.execute(text("""
        SELECT
            COALESCE(SUM(amount) FILTER (WHERE payment_context = 'hospital' AND status='success'), 0)   AS hospital,
            COALESCE(SUM(amount) FILTER (WHERE payment_context = 'pharmacy' AND status='success'), 0)   AS pharmacy,
            COALESCE(SUM(amount) FILTER (WHERE payment_context = 'lab'      AND status='success'), 0)   AS lab
        FROM payment_transactions WHERE created_at >= :month_start
    """), {"month_start": month_start})
    src = dict(src_result.mappings().first() or {})

    # Recent transactions
    txn_result = await db.execute(text("""
        SELECT id::text, amount, status, payment_method, payment_context, created_at
        FROM payment_transactions
        ORDER BY created_at DESC LIMIT 20
    """))
    txns = [dict(r) for r in txn_result.mappings().all()]

    return success_response(data={
        "revenue_today":        int(row.get("revenue_today") or 0),
        "revenue_month":        int(row.get("revenue_month") or 0),
        "failed_transactions":  int(row.get("failed_hour") or 0),
        "refunds_count":        int(row.get("refunds_month") or 0),
        "refunds_amount":       int(row.get("refund_amount_month") or 0),
        "by_source":            {"hospital": int(src.get("hospital") or 0), "pharmacy": int(src.get("pharmacy") or 0), "lab": int(src.get("lab") or 0)},
        "recent_transactions":  txns,
    })


# ════════════════════════════════════════════════════════════════════
# MODULE 19: AUDIT & COMPLIANCE
# ════════════════════════════════════════════════════════════════════

@router.get("/audit/logs")
async def audit_logs(
    actor_id:    Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    action:      Optional[str] = Query(None),
    page:        int           = Query(1, ge=1),
    limit:       int           = Query(50, le=500),
    db: AsyncSession = Depends(get_db),
):
    filters, params = ["1=1"], {"limit": limit, "offset": (page-1)*limit}
    if actor_id:    filters.append("al.actor_id::text ILIKE :actor");  params["actor"]  = f"%{actor_id}%"
    if entity_type: filters.append("al.entity_type = :etype");         params["etype"]  = entity_type
    if action:      filters.append("al.action ILIKE :action");         params["action"] = f"%{action}%"
    where = " AND ".join(filters)

    result = await db.execute(text(f"""
        SELECT al.*, h.name AS entity_name
        FROM audit_logs al
        LEFT JOIN hospitals h ON al.entity_type='hospital' AND al.entity_id = h.id
        WHERE {where}
        ORDER BY al.created_at DESC
        LIMIT :limit OFFSET :offset
    """), params)
    rows = [dict(r) for r in result.mappings().all()]

    count_result = await db.execute(text(f"SELECT COUNT(*) FROM audit_logs al WHERE {where}"), params)
    total = count_result.scalar() or 0

    return success_response(data={"logs": rows, "total": total, "page": page, "limit": limit})


# ════════════════════════════════════════════════════════════════════
# MODULE 20: AI COPILOT QUERY LOG
# ════════════════════════════════════════════════════════════════════

class AiQueryLog(BaseModel):
    query:      str
    response:   str
    queried_by: Optional[str] = None
    latency_ms: Optional[int] = None


@router.post("/ai/log", status_code=201)
async def log_ai_query(body: AiQueryLog, db: AsyncSession = Depends(get_db)):
    await db.execute(text("""
        INSERT INTO matrix_ai_queries
          (id, queried_by, query, response, model, latency_ms, created_at)
        VALUES
          (gen_random_uuid(), :by, :q, :r, 'claude-sonnet-4-6', :lat, :now)
    """), {
        "by": body.queried_by, "q": body.query, "r": body.response,
        "lat": body.latency_ms, "now": datetime.now(timezone.utc),
    })
    await db.commit()
    return success_response(data={"logged": True})


@router.get("/ai/history")
async def ai_history(
    queried_by: Optional[str] = Query(None),
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    filters, params = ["1=1"], {"limit": limit}
    if queried_by:
        filters.append("queried_by = :by"); params["by"] = queried_by
    result = await db.execute(text(f"""
        SELECT id::text, queried_by, query, response, latency_ms, created_at
        FROM matrix_ai_queries
        WHERE {" AND ".join(filters)}
        ORDER BY created_at DESC
        LIMIT :limit
    """), params)
    rows = [dict(r) for r in result.mappings().all()]
    return success_response(data={"history": rows})
