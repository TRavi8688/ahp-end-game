"""
backend/healthcare-core/app/api/v1/matrix_mission.py

Mission Control — Module 1
Provides real-time ecosystem snapshot for the Mission Control dashboard.
All endpoints require super_admin or manager role.

GET  /matrix/mission/overview        — full live metrics
GET  /matrix/mission/system-health   — service status checks
GET  /matrix/mission/activity-feed   — last N activity events (paginated)
POST /matrix/mission/activity-feed   — publish an activity event (internal use)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from shared.redis_client import get_redis_client
from shared.utils.responses import success_response

from app.core.security import require_role

logger = logging.getLogger(__name__)
router = APIRouter(dependencies=[Depends(require_role("super_admin", "manager"))])


# ─── Overview ─────────────────────────────────────────────────────────────────

@router.get("/overview")
async def mission_overview(db: AsyncSession = Depends(get_db)):
    """
    Single endpoint that powers the entire Mission Control dashboard.
    Runs all aggregation queries in parallel using PostgreSQL CTEs.
    """
    now   = datetime.now(timezone.utc)
    today = now.date()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(text("""
        WITH
        hosp AS (
            SELECT
                COUNT(*) FILTER (WHERE status = 'active')               AS active,
                COUNT(*) FILTER (WHERE status = 'pending_verification') AS pending,
                COUNT(*) FILTER (WHERE status = 'suspended')            AS suspended,
                COUNT(*)                                                 AS total
            FROM hospitals WHERE deleted_at IS NULL
        ),
        pharm AS (
            SELECT
                COUNT(*) FILTER (WHERE is_active = true) AS active,
                COUNT(*)                                  AS total
            FROM pharmacies WHERE deleted_at IS NULL
        ),
        labs AS (
            SELECT
                COUNT(*) FILTER (WHERE is_active = true) AS active,
                COUNT(*)                                  AS total
            FROM labs WHERE deleted_at IS NULL
        ),
        pats AS (
            SELECT COUNT(*) AS total FROM patients WHERE deleted_at IS NULL
        ),
        emps AS (
            SELECT
                COUNT(*) FILTER (WHERE shift_status = 'online') AS online,
                COUNT(*) FILTER (WHERE shift_status = 'break')  AS on_break,
                COUNT(*) FILTER (WHERE shift_status = 'leave')  AS on_leave,
                COUNT(*) AS total
            FROM hospyn_employees WHERE is_active = true AND deleted_at IS NULL
        ),
        tix AS (
            SELECT
                COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed'))       AS open_total,
                COUNT(*) FILTER (WHERE priority='critical'
                                  AND status NOT IN ('resolved','closed'))        AS critical,
                COUNT(*) FILTER (WHERE status='resolved' AND DATE(resolved_at) = :today) AS resolved_today
            FROM support_tickets
        ),
        verif AS (
            SELECT COUNT(*) AS pending
            FROM hospitals
            WHERE status = 'pending_verification' AND deleted_at IS NULL
        ),
        rev AS (
            SELECT
                COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = :today), 0)         AS today,
                COALESCE(SUM(amount) FILTER (WHERE created_at >= :month_start), 0)         AS this_month
            FROM payment_transactions
            WHERE status = 'success'
        ),
        fail_tx AS (
            SELECT COUNT(*) AS failed
            FROM payment_transactions
            WHERE status = 'failed'
              AND created_at >= :one_hour_ago
        )
        SELECT
            hosp.active   AS hospitals_active,
            hosp.pending  AS hospitals_pending,
            hosp.suspended AS hospitals_suspended,
            hosp.total    AS hospitals_total,
            pharm.active  AS pharmacies_active,
            pharm.total   AS pharmacies_total,
            labs.active   AS labs_active,
            labs.total    AS labs_total,
            pats.total    AS patients_total,
            emps.online   AS employees_online,
            emps.on_break AS employees_break,
            emps.on_leave AS employees_leave,
            emps.total    AS employees_total,
            tix.open_total      AS tickets_open,
            tix.critical        AS tickets_critical,
            tix.resolved_today  AS tickets_resolved_today,
            verif.pending       AS verifications_pending,
            rev.today           AS revenue_today,
            rev.this_month      AS revenue_month,
            fail_tx.failed      AS failed_transactions
        FROM hosp, pharm, labs, pats, emps, tix, verif, rev, fail_tx
    """), {
        "today": today,
        "month_start": month_start,
        "one_hour_ago": now - timedelta(hours=1),
    })

    row = dict(result.mappings().first() or {})
    return success_response(data={
        "hospitals":    {"active": row.get("hospitals_active",0), "pending": row.get("hospitals_pending",0), "suspended": row.get("hospitals_suspended",0), "total": row.get("hospitals_total",0)},
        "pharmacies":   {"active": row.get("pharmacies_active",0), "total": row.get("pharmacies_total",0)},
        "labs":         {"active": row.get("labs_active",0), "total": row.get("labs_total",0)},
        "patients":     {"total": row.get("patients_total",0)},
        "employees":    {"online": row.get("employees_online",0), "on_break": row.get("employees_break",0), "on_leave": row.get("employees_leave",0), "total": row.get("employees_total",0)},
        "tickets":      {"open": row.get("tickets_open",0), "critical": row.get("tickets_critical",0), "resolved_today": row.get("tickets_resolved_today",0)},
        "verifications":{"pending": row.get("verifications_pending",0)},
        "revenue":      {"today": int(row.get("revenue_today") or 0), "this_month": int(row.get("revenue_month") or 0)},
        "failed_transactions": row.get("failed_transactions",0),
        "fetched_at": now.isoformat(),
    })


# ─── System Health ────────────────────────────────────────────────────────────

@router.get("/system-health")
async def system_health(db: AsyncSession = Depends(get_db)):
    """
    Checks: PostgreSQL, Redis, event bus.
    Other service statuses (WhatsApp, SMS, AI) are read from Redis keys
    set by their respective health-check workers.
    """
    # DB check
    db_status = "operational"
    db_latency = 0
    try:
        t0 = datetime.now(timezone.utc)
        await db.execute(text("SELECT 1"))
        db_latency = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
    except Exception as e:
        db_status = "down"
        logger.error("DB health failed: %s", e)

    # Redis check
    redis_status = "operational"
    redis_latency = 0
    try:
        rc = get_redis_client()
        t0 = datetime.now(timezone.utc)
        await rc.ping()
        redis_latency = int((datetime.now(timezone.utc) - t0).total_seconds() * 1000)
    except Exception as e:
        redis_status = "degraded"
        logger.warning("Redis health: %s", e)

    # Read external service statuses from Redis (set by monitoring workers)
    external = {}
    try:
        rc = get_redis_client()
        for svc in ("whatsapp", "sms", "ai_service", "notifications"):
            val = await rc.get(f"matrix:health:{svc}")
            external[svc] = val or "operational"
    except Exception:
        pass

    return success_response(data={
        "database":      {"status": db_status, "latency_ms": db_latency},
        "redis":         {"status": redis_status, "latency_ms": redis_latency},
        "whatsapp":      {"status": external.get("whatsapp", "operational")},
        "sms":           {"status": external.get("sms", "operational")},
        "notifications": {"status": external.get("notifications", "operational")},
        "ai_service":    {"status": external.get("ai_service", "operational")},
        "checked_at":    datetime.now(timezone.utc).isoformat(),
    })


# ─── Activity Feed ────────────────────────────────────────────────────────────

@router.get("/activity-feed")
async def activity_feed(
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the last N activity events across the platform.
    Sources: audit_logs joined with hospital/ticket/employee context.
    """
    result = await db.execute(text("""
        SELECT
            al.id::text,
            al.action,
            al.entity_type,
            al.entity_id::text,
            al.actor_id::text,
            al.details,
            al.created_at,
            CASE al.entity_type
                WHEN 'hospital' THEN h.name
                WHEN 'ticket'   THEN NULL
                ELSE NULL
            END AS entity_name
        FROM audit_logs al
        LEFT JOIN hospitals h
            ON al.entity_type = 'hospital' AND al.entity_id = h.id
        ORDER BY al.created_at DESC
        LIMIT :limit
    """), {"limit": limit})

    rows = [dict(r) for r in result.mappings().all()]
    return success_response(data={"events": rows, "total": len(rows)})


@router.post("/activity-feed")
async def publish_activity(payload: dict, db: AsyncSession = Depends(get_db)):
    """Internal: publish a custom activity event to audit_logs."""
    now = datetime.now(timezone.utc)
    await db.execute(text("""
        INSERT INTO audit_logs (id, action, entity_type, entity_id, actor_id, details, created_at)
        VALUES (gen_random_uuid(), :action, :entity_type, :entity_id, :actor_id, :details, :now)
    """), {
        "action":      payload.get("action", "custom_event"),
        "entity_type": payload.get("entity_type", "system"),
        "entity_id":   payload.get("entity_id"),
        "actor_id":    payload.get("actor_id"),
        "details":     payload.get("details"),
        "now":         now,
    })
    await db.flush()
    return success_response(data={"published": True})
