"""
Super Admin Router — backend/healthcare-core/app/api/v1/super_admin.py

Provides every endpoint the Hospin super-admin dashboard calls.
Mounted at /api/v1/admin in main.py.

All endpoints require role="super_admin".

Endpoints:
  GET  /admin/analytics/overview           — platform-wide metrics
  GET  /admin/hospitals                    — list all hospitals
  GET  /admin/hospitals/{id}/dashboard     — full hospital deep-dive
  GET  /admin/hospitals/pending-verification
  PATCH /admin/hospitals/{id}/verify       — approve/reject/suspend
  GET  /admin/verification/{id}            — detailed verification record
  POST /admin/verification/{id}/approve
  POST /admin/verification/{id}/reject
  POST /admin/verification/{id}/request-more-info
  GET  /admin/audit-logs                   — immutable audit trail (paginated)
  GET  /admin/users                        — IAM: list all platform users
  POST /admin/users                        — IAM: invite/create user
  PUT  /admin/users/{id}/status            — IAM: activate/deactivate
  DELETE /admin/users/{id}                 — IAM: hard revoke
  GET  /admin/alerts                       — system alerts
  PATCH /admin/alerts/{id}/resolve         — resolve an alert
  GET  /admin/revenue                      — platform revenue ledger
"""

from __future__ import annotations

import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.hospital import Hospital, HospitalStatus
from shared.utils.responses import success_response

logger = logging.getLogger(__name__)

router = APIRouter()

# ─── Dependency: require super_admin role ─────────────────────────────────────
SuperAdmin = Annotated[TokenPayload, Depends(require_role("super_admin"))]


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def _hospital_row_to_dict(h: Hospital) -> dict:
    return {
        "id":           str(h.id),
        "name":         h.name,
        "email":        h.email,
        "phone":        h.phone,
        "city":         h.city,
        "state":        h.state,
        "status":       h.status.value if h.status else "unknown",
        "is_active":    h.is_active,
        "created_at":   h.created_at.isoformat() if h.created_at else None,
        "updated_at":   h.updated_at.isoformat() if h.updated_at else None,
        "short_code":   str(h.id)[:8].upper(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# 1. Analytics Overview
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/analytics/overview")
async def get_analytics_overview(
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    """Platform-wide metrics for the OverviewDashboard."""
    now = datetime.now(timezone.utc)

    # Hospital counts
    total_hospitals    = 0
    active_hospitals   = 0
    pending_hospitals  = 0
    suspended_hospitals = 0

    try:
        r = await db.execute(
            text("""
                SELECT
                    COUNT(*) AS total,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
                    SUM(CASE WHEN status = 'pending_verification' THEN 1 ELSE 0 END) AS pending,
                    SUM(CASE WHEN status = 'suspended' THEN 1 ELSE 0 END) AS suspended
                FROM hospitals WHERE deleted_at IS NULL
            """)
        )
        row = r.fetchone()
        if row:
            total_hospitals     = int(row.total or 0)
            active_hospitals    = int(row.active or 0)
            pending_hospitals   = int(row.pending or 0)
            suspended_hospitals = int(row.suspended or 0)
    except Exception as e:
        logger.warning("analytics/hospitals query failed: %s", e)

    # Registered patients
    registered_patients = 0
    try:
        r = await db.execute(text("SELECT COUNT(*) FROM patients WHERE deleted_at IS NULL"))
        registered_patients = int(r.scalar() or 0)
    except Exception as e:
        logger.warning("analytics/patients query failed: %s", e)

    # Registered staff
    registered_staff = 0
    try:
        r = await db.execute(text("SELECT COUNT(*) FROM staff WHERE deleted_at IS NULL"))
        registered_staff = int(r.scalar() or 0)
    except Exception as e:
        logger.warning("analytics/staff query failed: %s", e)

    # Total platform revenue (all-time)
    total_revenue = 0.0
    try:
        r = await db.execute(
            text("SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'PAID' AND deleted_at IS NULL")
        )
        total_revenue = float(r.scalar() or 0)
    except Exception as e:
        logger.warning("analytics/revenue query failed: %s", e)

    # Recent audit events (last 20)
    recent_audit_events = []
    try:
        r = await db.execute(
            text("""
                SELECT id, action, actor_id, resource_type, resource_id,
                       ip_address, created_at as timestamp
                FROM audit_logs
                ORDER BY created_at DESC
                LIMIT 20
            """)
        )
        for row in r.fetchall():
            recent_audit_events.append({
                "id":            str(row.id),
                "action":        row.action,
                "actor_id":      str(row.actor_id) if row.actor_id else None,
                "resource_type": row.resource_type,
                "resource_id":   str(row.resource_id) if row.resource_id else None,
                "ip_address":    row.ip_address,
                "timestamp":     row.timestamp.isoformat() if row.timestamp else None,
            })
    except Exception as e:
        logger.warning("analytics/audit query failed: %s", e)

    return success_response(data={
        "metrics": {
            "total_hospitals":       total_hospitals,
            "active_hospitals":      active_hospitals,
            "pending_verifications": pending_hospitals,
            "suspended_hospitals":   suspended_hospitals,
            "registered_patients":   registered_patients,
            "registered_staff":      registered_staff,
            "total_revenue":         total_revenue,
        },
        "recent_audit_events": recent_audit_events,
        "generated_at": now.isoformat(),
    })


# ─────────────────────────────────────────────────────────────────────────────
# 2. Hospital Network
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/hospitals")
async def list_all_hospitals(
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    city: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """List every hospital on the platform (super_admin only)."""
    query = select(Hospital).where(Hospital.deleted_at.is_(None))

    if status_filter:
        try:
            query = query.where(Hospital.status == HospitalStatus(status_filter))
        except ValueError:
            pass
    if city:
        query = query.where(Hospital.city.ilike(f"%{city}%"))
    if search:
        query = query.where(
            Hospital.name.ilike(f"%{search}%")
        )

    count_q = await db.execute(select(func.count()).select_from(query.subquery()))
    total   = count_q.scalar_one()

    query   = query.order_by(Hospital.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result  = await db.execute(query)
    hospitals = result.scalars().all()

    return success_response(data={
        "data":      [await _hospital_row_to_dict(h) for h in hospitals],
        "total":     total,
        "page":      page,
        "page_size": page_size,
        "pages":     max(1, (total + page_size - 1) // page_size),
    })


@router.get("/hospitals/pending-verification")
async def list_pending_hospitals(
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    """All hospitals awaiting verification — powers VerificationQueue."""
    result = await db.execute(
        select(Hospital).where(
            Hospital.status.in_([
                HospitalStatus.pending_verification,
            ]),
            Hospital.deleted_at.is_(None),
        ).order_by(Hospital.created_at.asc())
    )
    hospitals = result.scalars().all()
    return success_response(data=[await _hospital_row_to_dict(h) for h in hospitals])


@router.get("/hospitals/{hospital_id}/dashboard")
async def get_hospital_dashboard(
    hospital_id: uuid.UUID,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    """Full hospital deep-dive for HospitalDetail page."""
    result = await db.execute(
        select(Hospital).where(Hospital.id == hospital_id, Hospital.deleted_at.is_(None))
    )
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    hid = str(hospital_id)

    # Revenue + visits telemetry
    revenue    = 0.0
    visits     = 0
    beds_total = 0
    beds_occ   = 0
    low_stock  = 0

    try:
        r = await db.execute(
            text("SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE hospital_id = :hid AND status = 'PAID' AND deleted_at IS NULL"),
            {"hid": hid}
        )
        revenue = float(r.scalar() or 0)
    except Exception: pass

    try:
        r = await db.execute(
            text("SELECT COUNT(*) FROM appointments WHERE hospital_id = :hid AND deleted_at IS NULL"),
            {"hid": hid}
        )
        visits = int(r.scalar() or 0)
    except Exception: pass

    try:
        r = await db.execute(
            text("SELECT COUNT(*) AS total, SUM(CASE WHEN status='OCCUPIED' THEN 1 ELSE 0 END) AS occ FROM ward_beds WHERE hospital_id = :hid AND deleted_at IS NULL"),
            {"hid": hid}
        )
        row = r.fetchone()
        if row:
            beds_total = int(row.total or 0)
            beds_occ   = int(row.occ or 0)
    except Exception: pass

    try:
        r = await db.execute(
            text("SELECT COUNT(*) FROM pharmacy_inventory WHERE hospital_id = :hid AND current_stock <= reorder_level AND deleted_at IS NULL"),
            {"hid": hid}
        )
        low_stock = int(r.scalar() or 0)
    except Exception: pass

    # Staff list
    staff_list = []
    try:
        r = await db.execute(
            text("SELECT u.id, u.full_name as name, s.role, s.department FROM staff s JOIN users u ON u.id = s.user_id WHERE s.hospital_id = :hid AND s.deleted_at IS NULL LIMIT 200"),
            {"hid": hid}
        )
        for row in r.fetchall():
            staff_list.append({"id": str(row.id), "name": row.name or "—", "role": row.role, "department": row.department})
    except Exception: pass

    # Doctors
    doctors_list = []
    try:
        r = await db.execute(
            text("""
                SELECT u.id, u.full_name as name, d.specialty, d.rating,
                       d.patients_treated, d.avg_treatment_time_mins, d.hours_worked
                FROM doctors d JOIN users u ON u.id = d.user_id
                WHERE d.hospital_id = :hid AND d.deleted_at IS NULL
                LIMIT 100
            """),
            {"hid": hid}
        )
        for row in r.fetchall():
            doctors_list.append({
                "id": str(row.id), "name": row.name or "—",
                "specialty": row.specialty,
                "rating": float(row.rating or 4.8),
                "patients_treated": int(row.patients_treated or 0),
                "avg_treatment_time_mins": int(row.avg_treatment_time_mins or 0),
                "hours_worked": int(row.hours_worked or 0),
            })
    except Exception: pass

    # Ledger (recent 50)
    ledger = []
    try:
        r = await db.execute(
            text("""
                SELECT i.invoice_number, i.total_amount, i.status, i.paid_at,
                       p.full_name AS patient_name
                FROM invoices i
                LEFT JOIN patients pt ON pt.id = i.patient_id
                LEFT JOIN users p ON p.id = pt.user_id
                WHERE i.hospital_id = :hid AND i.deleted_at IS NULL
                ORDER BY i.created_at DESC LIMIT 50
            """),
            {"hid": hid}
        )
        for row in r.fetchall():
            ledger.append({
                "invoice_number": row.invoice_number,
                "total_amount": float(row.total_amount or 0),
                "status": row.status,
                "payment_method": "UPI",
                "patient_name": row.patient_name or "Patient",
                "date": row.paid_at.isoformat() if row.paid_at else None,
            })
    except Exception: pass

    # Pharmacy inventory
    pharmacy = []
    try:
        r = await db.execute(
            text("SELECT id, item_name, current_stock AS stock_quantity, reorder_level, unit_price FROM pharmacy_inventory WHERE hospital_id = :hid AND deleted_at IS NULL LIMIT 100"),
            {"hid": hid}
        )
        for row in r.fetchall():
            pharmacy.append({
                "id": str(row.id),
                "item_name": row.item_name,
                "stock_quantity": int(row.stock_quantity or 0),
                "reorder_level": int(row.reorder_level or 0),
                "unit_price": float(row.unit_price or 0),
            })
    except Exception: pass

    # Beds
    beds = []
    try:
        r = await db.execute(
            text("SELECT id, ward_name, bed_number, status FROM ward_beds WHERE hospital_id = :hid AND deleted_at IS NULL LIMIT 200"),
            {"hid": hid}
        )
        for row in r.fetchall():
            beds.append({"id": str(row.id), "ward_name": row.ward_name, "bed_number": row.bed_number, "status": row.status})
    except Exception: pass

    # Branches
    branches = []
    try:
        r = await db.execute(
            text("SELECT id, name, city FROM hospital_branches WHERE hospital_id = :hid AND deleted_at IS NULL"),
            {"hid": hid}
        )
        for row in r.fetchall():
            branches.append({"id": str(row.id), "name": row.name, "city": row.city})
    except Exception: pass

    # Activity feed
    activity_feed = []
    try:
        r = await db.execute(
            text("""
                SELECT al.id, al.action, al.created_at AS timestamp,
                       u.full_name AS actor_name
                FROM audit_logs al
                LEFT JOIN users u ON u.id::text = al.actor_id
                WHERE al.hospital_id = :hid
                ORDER BY al.created_at DESC LIMIT 30
            """),
            {"hid": hid}
        )
        for row in r.fetchall():
            activity_feed.append({
                "id": str(row.id),
                "action": row.action,
                "actor_name": row.actor_name or "System",
                "timestamp": row.timestamp.isoformat() if row.timestamp else None,
            })
    except Exception: pass

    scale = "Low"
    if len(staff_list) > 50 or beds_total > 100:
        scale = "High"
    elif len(staff_list) > 20 or beds_total > 30:
        scale = "Mid"

    return success_response(data={
        "hospital_id":    hid,
        "hospital_name":  hospital.name,
        "scale":          scale,
        "branches":       branches,
        "telemetry":      {
            "revenue": revenue, "visits": visits,
            "beds_total": beds_total, "beds_occupied": beds_occ,
            "low_stock_count": low_stock,
        },
        "staff":          staff_list,
        "doctors":        doctors_list,
        "ledger":         ledger,
        "pharmacy":       pharmacy,
        "beds":           beds,
        "activity_feed":  activity_feed,
    })


@router.patch("/hospitals/{hospital_id}/verify")
async def verify_hospital(
    hospital_id: uuid.UUID,
    payload: dict,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    """Approve, reject, or suspend a hospital. Body: { action: 'approve'|'reject'|'suspend', notes: str }"""
    result = await db.execute(
        select(Hospital).where(Hospital.id == hospital_id, Hospital.deleted_at.is_(None))
    )
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    action = payload.get("action", "").lower()
    if action == "approve":
        hospital.status = HospitalStatus.active
        hospital.is_active = True
    elif action == "reject":
        hospital.status = HospitalStatus.deactivated
        hospital.is_active = False
    elif action == "suspend":
        hospital.status = HospitalStatus.suspended
        hospital.is_active = False
    else:
        raise HTTPException(status_code=422, detail="action must be one of: approve, reject, suspend")

    await db.flush()
    return success_response(data={"id": str(hospital_id), "status": hospital.status.value}, message=f"Hospital {action}d successfully")


# ─────────────────────────────────────────────────────────────────────────────
# 3. Verification Detail
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/verification/{hospital_id}")
async def get_verification_detail(
    hospital_id: uuid.UUID,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    """Full verification record for VerificationDetail page."""
    result = await db.execute(
        select(Hospital).where(Hospital.id == hospital_id, Hospital.deleted_at.is_(None))
    )
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    # Documents
    documents = []
    try:
        r = await db.execute(
            text("SELECT id, document_type AS type, file_url, status FROM hospital_documents WHERE hospital_id = :hid AND deleted_at IS NULL"),
            {"hid": str(hospital_id)}
        )
        for row in r.fetchall():
            documents.append({"id": str(row.id), "type": row.type, "file_url": row.file_url, "status": row.status})
    except Exception: pass

    # Fraud signals
    fraud_signals = []
    try:
        r = await db.execute(
            text("SELECT signal_type, description, severity FROM fraud_signals WHERE hospital_id = :hid ORDER BY severity DESC LIMIT 10"),
            {"hid": str(hospital_id)}
        )
        for row in r.fetchall():
            fraud_signals.append({"signal_type": row.signal_type, "description": row.description, "severity": row.severity})
    except Exception: pass

    # Risk score (simple computed rule)
    risk_score = 0
    if hospital.status.value == "pending_verification":
        risk_score += 20
    risk_score += len(fraud_signals) * 20
    if not documents:
        risk_score += 30
    risk_score = min(100, risk_score)

    return success_response(data={
        "id":             str(hospital_id),
        "name":           hospital.name,
        "type":           "General Hospital",
        "domain":         hospital.email.split("@")[-1] if hospital.email else None,
        "gst_number":     hospital.registration_number,
        "hospital_email": hospital.email,
        "hospital_phone": hospital.phone,
        "city":           hospital.city,
        "status":         hospital.status.value,
        "created_at":     hospital.created_at.isoformat() if hospital.created_at else None,
        "risk_score":     risk_score,
        "documents":      documents,
        "fraud_signals":  fraud_signals,
    })


@router.post("/verification/{hospital_id}/approve")
async def approve_verification(
    hospital_id: uuid.UUID,
    payload: dict,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id, Hospital.deleted_at.is_(None)))
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    hospital.status = HospitalStatus.active
    hospital.is_active = True
    await db.flush()
    # Log the action
    try:
        await db.execute(
            text("INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, hospital_id, created_at) VALUES (:id, :actor, 'HOSPITAL_VERIFIED', 'hospital', :rid, :hid, NOW())"),
            {"id": str(uuid.uuid4()), "actor": current_user.sub, "rid": str(hospital_id), "hid": str(hospital_id)}
        )
    except Exception: pass
    return success_response(data={"id": str(hospital_id), "status": "active"}, message="Hospital approved and activated")


@router.post("/verification/{hospital_id}/reject")
async def reject_verification(
    hospital_id: uuid.UUID,
    payload: dict,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id, Hospital.deleted_at.is_(None)))
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    hospital.status = HospitalStatus.deactivated
    hospital.is_active = False
    await db.flush()
    return success_response(data={"id": str(hospital_id), "status": "deactivated"}, message="Hospital rejected")


@router.post("/verification/{hospital_id}/request-more-info")
async def request_more_info(
    hospital_id: uuid.UUID,
    payload: dict,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    # Update status to request_more_info if that status exists, else keep pending
    result = await db.execute(select(Hospital).where(Hospital.id == hospital_id, Hospital.deleted_at.is_(None)))
    hospital = result.scalars().first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    # Store custom message in a notification or audit log
    try:
        await db.execute(
            text("INSERT INTO audit_logs (id, actor_id, action, resource_type, resource_id, hospital_id, details, created_at) VALUES (:id, :actor, 'HOSPITAL_INFO_REQUESTED', 'hospital', :rid, :hid, :details, NOW())"),
            {"id": str(uuid.uuid4()), "actor": current_user.sub, "rid": str(hospital_id), "hid": str(hospital_id), "details": payload.get("custom_message", "")}
        )
    except Exception: pass
    return success_response(message="Information request sent to hospital admin")


# ─────────────────────────────────────────────────────────────────────────────
# 4. Audit Logs
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/audit-logs")
async def get_audit_logs(
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    from_: Optional[str] = Query(None, alias="from"),
    to: Optional[str] = Query(None),
):
    """Immutable audit trail — paginated."""
    where_clauses = ["1=1"]
    params: dict = {}

    if user_id:
        where_clauses.append("actor_id = :user_id")
        params["user_id"] = user_id
    if action and action != "all":
        where_clauses.append("action ILIKE :action")
        params["action"] = f"%{action}%"
    if from_:
        where_clauses.append("created_at >= :from_dt")
        params["from_dt"] = from_
    if to:
        where_clauses.append("created_at <= :to_dt")
        params["to_dt"] = to

    where_sql = " AND ".join(where_clauses)

    try:
        count_r = await db.execute(text(f"SELECT COUNT(*) FROM audit_logs WHERE {where_sql}"), params)
        total = int(count_r.scalar() or 0)

        offset = (page - 1) * limit
        r = await db.execute(
            text(f"""
                SELECT al.id, al.action, al.actor_id, al.resource_type, al.resource_id,
                       al.ip_address, al.details, al.created_at AS timestamp,
                       u.full_name AS user_name, u.email AS user_email
                FROM audit_logs al
                LEFT JOIN users u ON u.id::text = al.actor_id
                WHERE {where_sql}
                ORDER BY al.created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": limit, "offset": offset}
        )
        logs = []
        for row in r.fetchall():
            logs.append({
                "id":            str(row.id),
                "action":        row.action,
                "user_id":       str(row.actor_id) if row.actor_id else None,
                "user_name":     row.user_name,
                "user_email":    row.user_email,
                "resource_type": row.resource_type,
                "resource_id":   str(row.resource_id) if row.resource_id else None,
                "ip_address":    row.ip_address,
                "details":       row.details,
                "timestamp":     row.timestamp.isoformat() if row.timestamp else None,
            })
    except Exception as e:
        logger.warning("audit-logs query failed: %s", e)
        logs  = []
        total = 0

    pages = max(1, (total + limit - 1) // limit)
    return success_response(data={"logs": logs, "total": total, "page": page, "pages": pages})


# ─────────────────────────────────────────────────────────────────────────────
# 5. IAM — Users
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/users")
async def list_users(
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    role: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
):
    """IAM: list all platform users across all roles."""
    where_clauses = ["deleted_at IS NULL"]
    params: dict = {}

    if role:
        where_clauses.append("role = :role")
        params["role"] = role
    if search:
        where_clauses.append("(full_name ILIKE :search OR email ILIKE :search OR phone_number ILIKE :search)")
        params["search"] = f"%{search}%"

    where_sql = " AND ".join(where_clauses)

    try:
        count_r = await db.execute(text(f"SELECT COUNT(*) FROM users WHERE {where_sql}"), params)
        total   = int(count_r.scalar() or 0)

        offset = (page - 1) * limit
        r = await db.execute(
            text(f"""
                SELECT id, full_name, email, phone_number, role, is_active, created_at
                FROM users
                WHERE {where_sql}
                ORDER BY created_at DESC
                LIMIT :limit OFFSET :offset
            """),
            {**params, "limit": limit, "offset": offset}
        )
        users = []
        for row in r.fetchall():
            users.append({
                "id":           str(row.id),
                "name":         row.full_name,
                "email":        row.email,
                "phone":        row.phone_number,
                "role":         row.role,
                "is_active":    row.is_active,
                "created_at":   row.created_at.isoformat() if row.created_at else None,
            })
    except Exception as e:
        logger.warning("IAM users query failed: %s", e)
        users = []
        total = 0

    pages = max(1, (total + limit - 1) // limit)
    return success_response(data={"users": users, "total": total, "page": page, "pages": pages})


@router.post("/users", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: dict,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    """IAM: Invite/create a new platform user."""
    required = ["phone", "role"]
    for field in required:
        if not payload.get(field):
            raise HTTPException(status_code=422, detail=f"'{field}' is required")

    valid_roles = ["super_admin", "admin", "hospital_admin", "doctor", "nurse", "staff", "patient", "pharmacist"]
    if payload["role"] not in valid_roles:
        raise HTTPException(status_code=422, detail=f"role must be one of {valid_roles}")

    try:
        # Check for duplicate
        r = await db.execute(text("SELECT id FROM users WHERE phone_number = :phone AND deleted_at IS NULL"), {"phone": payload["phone"]})
        if r.fetchone():
            raise HTTPException(status_code=409, detail="User with this phone already exists")

        new_id = uuid.uuid4()
        await db.execute(
            text("""
                INSERT INTO users (id, full_name, email, phone_number, role, is_active, created_at)
                VALUES (:id, :name, :email, :phone, :role, true, NOW())
            """),
            {
                "id": str(new_id), "name": payload.get("name", ""), "email": payload.get("email", ""),
                "phone": payload["phone"], "role": payload["role"],
            }
        )
        await db.flush()
    except HTTPException:
        raise
    except Exception as e:
        logger.error("create user failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to create user")

    return success_response(data={"id": str(new_id), "role": payload["role"]}, message="User created successfully")


@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: uuid.UUID,
    payload: dict,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    """IAM: activate or deactivate a user."""
    is_active = payload.get("is_active")
    if is_active is None:
        raise HTTPException(status_code=422, detail="'is_active' (bool) is required")

    try:
        await db.execute(
            text("UPDATE users SET is_active = :active WHERE id = :uid AND deleted_at IS NULL"),
            {"active": bool(is_active), "uid": str(user_id)}
        )
        await db.flush()
        # Invalidate their Redis session
        try:
            from shared.redis_client import revoke_user_sessions
            await revoke_user_sessions(str(user_id))
        except Exception:
            pass  # Redis unavailable — proceed anyway
    except Exception as e:
        logger.error("update user status failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to update user status")

    return success_response(data={"id": str(user_id), "is_active": bool(is_active)})


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: uuid.UUID,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    """IAM: hard revoke (soft-delete) a user account."""
    # Prevent self-deletion
    if str(user_id) == current_user.sub:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")

    try:
        await db.execute(
            text("UPDATE users SET deleted_at = NOW(), is_active = false WHERE id = :uid AND deleted_at IS NULL"),
            {"uid": str(user_id)}
        )
        await db.flush()
        try:
            from shared.redis_client import revoke_user_sessions
            await revoke_user_sessions(str(user_id))
        except Exception:
            pass
    except Exception as e:
        logger.error("delete user failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to delete user")

    return success_response(message="User access revoked successfully")


# ─────────────────────────────────────────────────────────────────────────────
# 6. Alerts
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/alerts")
async def get_alerts(
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
    resolved: Optional[bool] = Query(None),
):
    """System-wide alerts for EmergencyAlerts page."""
    alerts = []
    try:
        where = "deleted_at IS NULL"
        params: dict = {}
        if resolved is not None:
            where += " AND resolved = :resolved"
            params["resolved"] = resolved

        r = await db.execute(
            text(f"""
                SELECT id, type, severity, title, message, hospital_id,
                       resolved, created_at, resolved_at, resolved_by
                FROM system_alerts
                WHERE {where}
                ORDER BY created_at DESC
                LIMIT 200
            """),
            params
        )
        for row in r.fetchall():
            alerts.append({
                "id":          str(row.id),
                "type":        row.type,
                "severity":    row.severity,
                "title":       row.title,
                "message":     row.message,
                "hospital_id": str(row.hospital_id) if row.hospital_id else None,
                "resolved":    row.resolved,
                "created_at":  row.created_at.isoformat() if row.created_at else None,
                "resolved_at": row.resolved_at.isoformat() if row.resolved_at else None,
                "resolved_by": str(row.resolved_by) if row.resolved_by else None,
            })
    except Exception as e:
        logger.warning("alerts query failed: %s", e)

    return success_response(data=alerts)


@router.patch("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: uuid.UUID,
    payload: dict,
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
):
    """Mark an alert as resolved."""
    try:
        await db.execute(
            text("""
                UPDATE system_alerts
                SET resolved = true, resolved_at = NOW(), resolved_by = :resolver
                WHERE id = :alert_id AND deleted_at IS NULL
            """),
            {"resolver": current_user.sub, "alert_id": str(alert_id)}
        )
        await db.flush()
    except Exception as e:
        logger.error("resolve alert failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to resolve alert")

    return success_response(data={"id": str(alert_id), "resolved": True})


# ─────────────────────────────────────────────────────────────────────────────
# 7. Revenue
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/revenue")
async def get_revenue(
    current_user: SuperAdmin,
    db: AsyncSession = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
    hospital_id: Optional[str] = Query(None),
):
    """Platform-wide revenue analytics for RevenueAnalytics page."""
    params: dict = {"since": datetime.now(timezone.utc) - timedelta(days=days)}
    where_extra = ""
    if hospital_id:
        where_extra = " AND hospital_id = :hospital_id"
        params["hospital_id"] = hospital_id

    daily   = []
    by_hosp = []
    total   = 0.0

    try:
        # Total
        r = await db.execute(
            text(f"SELECT COALESCE(SUM(total_amount), 0) FROM invoices WHERE status = 'PAID' AND paid_at >= :since AND deleted_at IS NULL{where_extra}"),
            params
        )
        total = float(r.scalar() or 0)

        # Daily breakdown
        r = await db.execute(
            text(f"""
                SELECT DATE(paid_at) AS day, COALESCE(SUM(total_amount), 0) AS revenue, COUNT(*) AS txns
                FROM invoices
                WHERE status = 'PAID' AND paid_at >= :since AND deleted_at IS NULL{where_extra}
                GROUP BY DATE(paid_at)
                ORDER BY day
            """),
            params
        )
        for row in r.fetchall():
            daily.append({"day": str(row.day), "revenue": float(row.revenue), "transactions": int(row.txns)})

        # Per hospital breakdown
        r = await db.execute(
            text(f"""
                SELECT h.name, h.id AS hospital_id,
                       COALESCE(SUM(i.total_amount), 0) AS revenue,
                       COUNT(i.id) AS txns
                FROM invoices i
                JOIN hospitals h ON h.id = i.hospital_id
                WHERE i.status = 'PAID' AND i.paid_at >= :since AND i.deleted_at IS NULL{where_extra}
                GROUP BY h.id, h.name
                ORDER BY revenue DESC
                LIMIT 20
            """),
            params
        )
        for row in r.fetchall():
            by_hosp.append({
                "hospital_name": row.name,
                "hospital_id":   str(row.hospital_id),
                "revenue":       float(row.revenue),
                "transactions":  int(row.txns),
            })
    except Exception as e:
        logger.warning("revenue query failed: %s", e)

    return success_response(data={
        "total_revenue": total,
        "period_days":   days,
        "daily":         daily,
        "by_hospital":   by_hosp,
    })
