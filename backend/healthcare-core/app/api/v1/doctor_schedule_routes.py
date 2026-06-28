"""
doctor_schedule_routes.py
Phase 4 -- Doctor App: Profile, Schedule, Settings, Analytics, Leave,
Break (with types), Roster & Holiday routes.

WHY THIS FILE EXISTS:
  doctor-app's frontend calls a long list of /doctor/* endpoints that
  simply do not exist anywhere in the backend:
    GET/PUT /doctor/profile
    GET     /doctor/schedule
    POST    /doctor/schedule/provision
    PUT     /doctor/settings
    GET     /doctor/analytics
    GET     /doctor/my-patients
    GET/POST/DELETE /doctor/leave
    GET     /doctor/earnings
    GET/PUT /doctor/availability
    GET     /doctor/notifications (+ read / read-all)
    POST    /doctor/send-phone-otp, /doctor/verify-phone-otp
  Plus the NEW full break-type system, monthly roster, and holiday
  calendar requested for the doctor app (break types beyond on/off,
  queue auto-pause tied to breaks, roster CRUD, holiday CRUD).

  This file ALSO fixes a structural bug: doctor_stats_alerts.py and
  doctor_extensions.py were BOTH registered at prefix "/doctor" with
  IDENTICAL route paths (/stats, /alerts, /access-history,
  /emergency/broadcast, /session/break/start, /session/break/end).
  FastAPI silently lets the last-registered router win, which is
  fragile and will break the moment import order changes.

  RECOMMENDATION: delete doctor_stats_alerts.py entirely (it is a
  stale duplicate -- doctor_extensions.py is the newer, kept version)
  and ALSO move the break/break-end endpoints out of doctor_extensions.py
  into this file, since this file's version supports break TYPES,
  duration estimates, and queue auto-pause -- the old one only flips a
  boolean. See "MIGRATION NOTE" at the bottom of this docstring.

DROP-IN INSTRUCTIONS:
  1. Save as: backend/healthcare-core/app/api/v1/doctor_schedule_routes.py
  2. In backend/healthcare-core/app/api/router.py:
       a) DELETE this line (stale duplicate):
            from app.api.v1.doctor_stats_alerts import router as doctor_extras_router
            api_router.include_router(doctor_extras_router, prefix="/doctor", tags=["Doctor Stats"])
       b) In doctor_extensions.py, DELETE the two break endpoints
          (start_break / end_break, lines ~326-415) since this file
          replaces them with typed versions at the SAME paths
          (/doctor/session/break/start, /doctor/session/break/end).
       c) Add:
            from app.api.v1.doctor_schedule_routes import router as doctor_schedule_router
            api_router.include_router(doctor_schedule_router, prefix="/doctor", tags=["Doctor Schedule"])
  3. Run the migration in migrations/0006_doctor_schedule_system.py first
     (read its docstring -- there's a pre-existing circular migration bug
     that must be fixed before this will apply).
  4. Add the new models to app/models/__init__.py (see doctor_schedule.py
     header for the exact import line).

MIGRATION NOTE (manual step, not code):
  After deleting the break endpoints from doctor_extensions.py, doctor
  status changes (DoctorStatus.on_break / .active) used by those old
  endpoints are now handled here instead -- same enum, same behavior,
  plus break-type logging and queue auto-pause.
"""

import logging
import uuid
from datetime import datetime, date, time, timezone, timedelta
from typing import Annotated, Optional
from calendar import monthrange

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, text
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.doctor import Doctor, DoctorStatus
from app.models.appointment import Appointment, AppointmentStatus, AppointmentSource
from app.models.patient import Patient
from app.models.doctor_schedule import (
    DoctorProfileExtension,
    DoctorLeave,
    DoctorBreakLog,
    RosterShift,
    Holiday,
    LeaveStatus,
    BreakType,
    ShiftType,
    LeaveType,
)
from shared.utils.responses import success_response, error_response
from shared.audit import log_audit_event

router = APIRouter()
_logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_doctor(db: AsyncSession, user_id_str: str) -> Doctor:
    """Resolves the authenticated user (TokenPayload.sub, a string) to their
    Doctor row. Matches the exact pattern used in doctor_queue.py's
    _resolve_doctor -- TokenPayload.sub is a plain string and must be cast
    to uuid.UUID before comparing against the UUID column."""
    result = await db.execute(
        select(Doctor).where(
            Doctor.user_id == uuid.UUID(user_id_str),
            Doctor.is_active == True,
            Doctor.deleted_at.is_(None),
        )
    )
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    return doctor


async def _get_or_create_extension(db: AsyncSession, doctor: Doctor) -> DoctorProfileExtension:
    result = await db.execute(
        select(DoctorProfileExtension).where(DoctorProfileExtension.doctor_id == doctor.id)
    )
    ext = result.scalars().first()
    if ext:
        return ext

    hospyn_id = f"HSP-{str(doctor.id)[:8].upper()}"
    ext = DoctorProfileExtension(
        id=uuid.uuid4(),
        doctor_id=doctor.id,
        hospyn_id=hospyn_id,
    )
    db.add(ext)
    await db.commit()
    await db.refresh(ext)
    return ext


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ProfileUpdatePayload(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    specialty: Optional[str] = Field(None, max_length=200)


class SettingsUpdatePayload(BaseModel):
    email_notifications_enabled: Optional[bool] = None
    sms_notifications_enabled: Optional[bool] = None
    session_timeout_minutes: Optional[int] = Field(None, ge=5, le=30)


class ProvisionSlotPayload(BaseModel):
    hospyn_id: str
    scheduled_time: str  # "YYYY-MM-DD HH:MM"
    duration_minutes: int = 30


class LeaveCreatePayload(BaseModel):
    leave_type: str
    start_date: date
    end_date: date
    reason: Optional[str] = Field(None, max_length=500)


class BreakStartPayload(BaseModel):
    break_type: str = "bio_break"
    expected_duration_minutes: Optional[int] = None
    note: Optional[str] = None


class RosterShiftPayload(BaseModel):
    shift_date: date
    shift_type: str
    start_time: Optional[str] = None  # "HH:MM"
    end_time: Optional[str] = None
    notes: Optional[str] = None


class HolidayCreatePayload(BaseModel):
    holiday_date: date
    name: str = Field(..., max_length=150)
    is_full_day: bool = True


class AvailabilitySlot(BaseModel):
    day_of_week: str  # MON | TUE | WED | THU | FRI | SAT | SUN
    start_time: str   # "HH:MM"
    end_time: str
    is_available: bool = True


# ===========================================================================
# PROFILE
# ===========================================================================

@router.get("/profile")
@router.get("/profile/me")
async def get_doctor_profile(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    """Doctor's own profile, merged with the extension table (hospyn_id,
    notification prefs, session timeout)."""
    doctor = await _get_doctor(db, current_user.sub)
    ext = await _get_or_create_extension(db, doctor)

    hospital_name = None
    try:
        result = await db.execute(
            text("SELECT name FROM hospitals WHERE id = :hid"),
            {"hid": str(doctor.hospital_id)},
        )
        row = result.first()
        hospital_name = row[0] if row else None
    except Exception as e:
        _logger.exception("Failed to fetch hospital name for doctor %s", doctor.id)

    return {
        "id": str(doctor.id),
        "first_name": doctor.first_name,
        "last_name": doctor.last_name,
        "email": doctor.email,
        "phone_number": doctor.phone,
        "specialty": doctor.specialization,
        "license_number": doctor.medical_license_number,
        "hospital_name": hospital_name,
        "hospyn_id": ext.hospyn_id,
        "email_notifications_enabled": ext.email_notifications_enabled,
        "sms_notifications_enabled": ext.sms_notifications_enabled,
        "session_timeout_minutes": ext.session_timeout_minutes,
        "two_factor_enabled": ext.two_factor_enabled,
        "status": doctor.status.value if doctor.status else None,
    }


@router.put("/profile")
async def update_doctor_profile(
    payload: ProfileUpdatePayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)

    if payload.first_name is not None:
        doctor.first_name = payload.first_name
    if payload.last_name is not None:
        doctor.last_name = payload.last_name
    if payload.specialty is not None:
        doctor.specialization = payload.specialty

    await db.commit()
    log_audit_event(
        action="doctor_profile_update",
        actor_id=str(current_user.sub),
        target_id=str(doctor.id),
        metadata={},
    )
    return success_response(message="Profile updated successfully")


@router.put("/settings")
async def update_doctor_settings(
    payload: SettingsUpdatePayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    ext = await _get_or_create_extension(db, doctor)

    if payload.email_notifications_enabled is not None:
        ext.email_notifications_enabled = payload.email_notifications_enabled
    if payload.sms_notifications_enabled is not None:
        ext.sms_notifications_enabled = payload.sms_notifications_enabled
    if payload.session_timeout_minutes is not None:
        ext.session_timeout_minutes = payload.session_timeout_minutes

    await db.commit()
    return success_response(message="Settings updated successfully")


# ===========================================================================
# SCHEDULE
# ===========================================================================

@router.get("/schedule")
async def get_weekly_schedule(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
    week_start: Optional[str] = Query(None, description="ISO date, defaults to this week's Monday"),
):
    """Returns appointments grouped MON..FRI for the doctor's schedule grid."""
    doctor = await _get_doctor(db, current_user.sub)

    today = datetime.now(timezone.utc).date()
    if week_start:
        try:
            monday = date.fromisoformat(week_start)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid week_start format. Use YYYY-MM-DD")
    else:
        monday = today - timedelta(days=today.weekday())
    friday = monday + timedelta(days=4)

    result = await db.execute(
        select(Appointment, Patient.first_name, Patient.last_name)
        .join(Patient, Appointment.patient_id == Patient.id, isouter=True)
        .where(
            and_(
                Appointment.doctor_id == doctor.id,
                func.date(Appointment.scheduled_at) >= monday,
                func.date(Appointment.scheduled_at) <= friday,
                Appointment.status != AppointmentStatus.cancelled,
            )
        )
        .order_by(Appointment.scheduled_at.asc())
    )
    rows = result.all()

    day_labels = ["MON", "TUE", "WED", "THU", "FRI"]
    schedule = {label: [] for label in day_labels}

    type_color = {
        "in_person": "teal",
        "teleconsultation": "purple",
        "follow_up": "amber",
        "emergency": "red",
    }

    for appt, p_first, p_last in rows:
        day_idx = appt.scheduled_at.weekday()
        if day_idx > 4:
            continue
        label = day_labels[day_idx]
        patient_name = f"{p_first} {p_last}".strip() if p_first else "Unknown Patient"
        schedule[label].append(
            {
                "id": str(appt.id),
                "patient": patient_name,
                "time": appt.scheduled_at.strftime("%I:%M %p"),
                "type": appt.appointment_type.value if appt.appointment_type else "in_person",
                "color": type_color.get(
                    appt.appointment_type.value if appt.appointment_type else "in_person", "teal"
                ),
                "status": appt.status.value if appt.status else None,
            }
        )

    return schedule


@router.post("/schedule/provision")
async def provision_slot(
    payload: ProvisionSlotPayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """Create a new appointment slot for a patient identified by Hospyn ID."""
    doctor = await _get_doctor(db, current_user.sub)

    patient_result = await db.execute(
        text("SELECT id, first_name, last_name FROM patients WHERE hospyn_id = :hid LIMIT 1"),
        {"hid": payload.hospyn_id},
    )
    patient_row = patient_result.first()
    if not patient_row:
        return error_response(
            error_code="PATIENT_NOT_FOUND",
            message="No patient found with that Hospyn ID. Please check and try again.",
            status_code=404,
        )

    try:
        scheduled_dt = datetime.strptime(payload.scheduled_time, "%Y-%m-%d %H:%M")
        scheduled_dt = scheduled_dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return error_response(
            error_code="INVALID_TIME",
            message="scheduled_time must be in 'YYYY-MM-DD HH:MM' format.",
            status_code=400,
        )

    new_appt = Appointment(
        id=uuid.uuid4(),
        patient_id=patient_row.id,
        doctor_id=doctor.id,
        hospital_id=doctor.hospital_id,
        scheduled_at=scheduled_dt,
        duration_minutes=payload.duration_minutes,
        status=AppointmentStatus.scheduled,
        source_type=AppointmentSource.receptionist,
    )
    db.add(new_appt)
    await db.commit()

    log_audit_event(
        action="schedule_slot_provisioned",
        actor_id=str(current_user.sub),
        target_id=str(new_appt.id),
        metadata={"patient_hospyn_id": payload.hospyn_id},
    )

    return {"success": True, "appointment_id": str(new_appt.id)}


# ===========================================================================
# ANALYTICS  (replaces hardcoded mock data in Analytics.jsx)
# ===========================================================================

@router.get("/analytics")
async def get_doctor_analytics(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)

    total_patients_result = await db.execute(
        select(func.count(func.distinct(Appointment.patient_id))).where(
            Appointment.doctor_id == doctor.id
        )
    )
    total_patients = total_patients_result.scalar() or 0

    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    weekly_result = await db.execute(
        select(
            func.date(Appointment.scheduled_at).label("d"),
            func.count(Appointment.id).label("c"),
        )
        .where(
            and_(
                Appointment.doctor_id == doctor.id,
                Appointment.scheduled_at >= week_ago,
                Appointment.status == AppointmentStatus.completed,
            )
        )
        .group_by(func.date(Appointment.scheduled_at))
    )
    weekly_rows = {str(row.d): row.c for row in weekly_result.all()}
    max_count = max(weekly_rows.values()) if weekly_rows else 1

    day_labels = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
    today = datetime.now(timezone.utc).date()
    weekly_stats = []
    for i in range(6, -1, -1):
        d = today - timedelta(days=i)
        weekly_stats.append(
            {
                "day": day_labels[d.weekday()],
                "count": weekly_rows.get(str(d), 0),
                "max": max_count,
            }
        )

    conditions_result = await db.execute(
        select(Appointment.chief_complaint, func.count(Appointment.id))
        .where(
            and_(
                Appointment.doctor_id == doctor.id,
                Appointment.chief_complaint.isnot(None),
            )
        )
        .group_by(Appointment.chief_complaint)
        .order_by(func.count(Appointment.id).desc())
        .limit(5)
    )
    condition_rows = conditions_result.all()
    total_conditions = sum(c for _, c in condition_rows) or 1
    palette = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#8b5cf6"]
    conditions = [
        {
            "label": (label or "Unspecified")[:20],
            "percent": round((count / total_conditions) * 100),
            "color": palette[i % len(palette)],
        }
        for i, (label, count) in enumerate(condition_rows)
    ]

    stable_result = await db.execute(
        select(func.count(func.distinct(Appointment.patient_id))).where(
            and_(Appointment.doctor_id == doctor.id, Appointment.status == AppointmentStatus.completed)
        )
    )
    followup_result = await db.execute(
        select(func.count(func.distinct(Appointment.patient_id))).where(
            and_(
                Appointment.doctor_id == doctor.id,
                Appointment.appointment_type == "follow_up",
            )
        )
    )
    high_risk_result = await db.execute(
        select(func.count(func.distinct(Appointment.patient_id))).where(
            and_(
                Appointment.doctor_id == doctor.id,
                Appointment.appointment_type == "emergency",
            )
        )
    )

    alerts = []
    try:
        alert_result = await db.execute(
            text(
                """
                SELECT dia.id, dia.title, dia.status, dia.created_at,
                       (p.first_name || ' ' || p.last_name) AS patient_name
                FROM drug_interaction_alerts dia
                JOIN patients p ON dia.patient_id = p.id
                WHERE dia.doctor_id = :doc_id
                  AND dia.created_at >= now() - interval '30 days'
                ORDER BY dia.created_at DESC
                LIMIT 20
                """
            ),
            {"doc_id": str(doctor.id)},
        )
        for row in alert_result.mappings():
            alerts.append(
                {
                    "title": row["title"],
                    "patient_name": row["patient_name"],
                    "date": row["created_at"].strftime("%d %b") if row["created_at"] else "",
                    "status": row["status"],
                }
            )
    except Exception as e:
        _logger.exception("Failed to fetch drug interaction alerts for doctor %s", doctor.id)

    return {
        "total_patients": total_patients,
        "stable_count": stable_result.scalar() or 0,
        "followup_count": followup_result.scalar() or 0,
        "high_risk_count": high_risk_result.scalar() or 0,
        "conditions": conditions,
        "weekly_stats": weekly_stats,
        "alerts": alerts,
    }


# ===========================================================================
# MY PATIENTS
# ===========================================================================

@router.get("/my-patients")
async def get_my_patients(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)

    result = await db.execute(
        text(
            """
            SELECT DISTINCT p.id, (p.first_name || ' ' || p.last_name) AS name, p.hospyn_id,
                   MAX(a.scheduled_at) AS last_visit
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = :doc_id
            GROUP BY p.id, p.first_name, p.last_name, p.hospyn_id
            ORDER BY last_visit DESC
            """
        ),
        {"doc_id": str(doctor.id)},
    )
    patients = [
        {
            "id": str(row.id),
            "name": row.name,
            "hospyn_id": row.hospyn_id,
            "last_visit": row.last_visit.isoformat() if row.last_visit else None,
            "status": "stable",
        }
        for row in result.fetchall()
    ]
    return patients


# ===========================================================================
# LEAVE MANAGEMENT
# ===========================================================================

LEAVE_TYPE_MAP = {
    "Day Off": "day_off",
    "Half Day": "half_day",
    "Emergency Leave": "emergency_leave",
    "Conference / CME": "conference_cme",
    "Personal": "personal",
    "Vacation": "vacation",
    "Sick": "sick",
}
LEAVE_TYPE_REVERSE = {v: k for k, v in LEAVE_TYPE_MAP.items()}
VALID_LEAVE_TYPES = [e.value for e in LeaveType]


@router.get("/leave")
async def get_leave_history(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    result = await db.execute(
        select(DoctorLeave)
        .where(DoctorLeave.doctor_id == doctor.id)
        .order_by(DoctorLeave.start_date.desc())
    )
    leaves = result.scalars().all()
    return {
        "leaves": [
            {
                "id": str(l.id),
                "leave_type": LEAVE_TYPE_REVERSE.get(l.leave_type.value, l.leave_type.value),
                "start_date": l.start_date.isoformat(),
                "end_date": l.end_date.isoformat(),
                "reason": l.reason,
                "status": l.status.value,
            }
            for l in leaves
        ]
    }


@router.post("/leave")
async def create_leave_request(
    payload: LeaveCreatePayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)

    if payload.end_date < payload.start_date:
        return error_response(
            error_code="INVALID_DATE_RANGE",
            message="End date cannot be before start date.",
            status_code=400,
        )

    internal_type = LEAVE_TYPE_MAP.get(payload.leave_type, payload.leave_type.lower().replace(" ", "_"))
    if internal_type not in VALID_LEAVE_TYPES:
        internal_type = "personal"

    leave = DoctorLeave(
        id=uuid.uuid4(),
        doctor_id=doctor.id,
        hospital_id=doctor.hospital_id,
        leave_type=internal_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        reason=payload.reason,
        status=LeaveStatus.pending,
    )
    db.add(leave)
    await db.commit()
    await db.refresh(leave)

    log_audit_event(
        action="doctor_leave_requested",
        actor_id=str(current_user.sub),
        target_id=str(leave.id),
        metadata={"leave_type": internal_type},
    )

    return success_response(
        data={"id": str(leave.id), "status": leave.status.value},
        message="Leave request submitted",
        status_code=201,
    )


@router.delete("/leave/{leave_id}")
async def cancel_leave_request(
    leave_id: str,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    result = await db.execute(
        select(DoctorLeave).where(
            and_(DoctorLeave.id == leave_id, DoctorLeave.doctor_id == doctor.id)
        )
    )
    leave = result.scalars().first()
    if not leave:
        raise HTTPException(status_code=404, detail="Leave request not found")

    leave.status = LeaveStatus.cancelled
    await db.commit()
    return success_response(message="Leave request cancelled")


# ===========================================================================
# BREAK SYSTEM -- typed breaks + queue auto-pause
# (Replaces the boolean-only break/start, break/end in doctor_extensions.py
#  -- same route paths, now records break TYPE and pauses the live queue.)
# ===========================================================================

@router.post("/session/break/start")
async def start_break(
    payload: BreakStartPayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)

    valid_types = [e.value for e in BreakType]
    break_type = payload.break_type if payload.break_type in valid_types else "other"

    break_log = DoctorBreakLog(
        id=uuid.uuid4(),
        doctor_id=doctor.id,
        break_type=break_type,
        expected_duration_minutes=payload.expected_duration_minutes,
        note=payload.note,
    )
    db.add(break_log)

    doctor.status = DoctorStatus.on_break

    try:
        await db.execute(
            text("UPDATE doctor_queue SET availability = FALSE WHERE doctor_id = :doc_id"),
            {"doc_id": str(doctor.id)},
        )
    except Exception as e:
        _logger.exception("Failed to update queue availability to False during break start for doctor %s", doctor.id)

    await db.commit()
    await db.refresh(break_log)

    log_audit_event(
        action="doctor_break_started",
        actor_id=str(current_user.sub),
        target_id=str(break_log.id),
        metadata={"break_type": break_type},
    )

    return {
        "status": "break_started",
        "break_id": str(break_log.id),
        "break_type": break_type,
        "started_at": break_log.started_at.isoformat() if break_log.started_at else None,
        "message": "Queue paused. Patients will see your status as on break.",
    }


@router.post("/session/break/end")
async def end_break(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)

    result = await db.execute(
        select(DoctorBreakLog)
        .where(
            and_(DoctorBreakLog.doctor_id == doctor.id, DoctorBreakLog.ended_at.is_(None))
        )
        .order_by(DoctorBreakLog.started_at.desc())
    )
    open_break = result.scalars().first()

    break_end = datetime.now(timezone.utc)
    if open_break:
        open_break.ended_at = break_end

    doctor.status = DoctorStatus.active

    try:
        await db.execute(
            text("UPDATE doctor_queue SET availability = TRUE WHERE doctor_id = :doc_id"),
            {"doc_id": str(doctor.id)},
        )
    except Exception as e:
        _logger.exception("Failed to update queue availability to True during break end for doctor %s", doctor.id)

    await db.commit()

    return {
        "status": "break_ended",
        "break_end_time": break_end.isoformat(),
        "message": "You are back online. Queue resumed.",
    }


@router.get("/breaks/today")
async def get_today_breaks(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    """Today's break history, used for a small timeline on the dashboard."""
    doctor = await _get_doctor(db, current_user.sub)
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(DoctorBreakLog)
        .where(
            and_(DoctorBreakLog.doctor_id == doctor.id, DoctorBreakLog.started_at >= today_start)
        )
        .order_by(DoctorBreakLog.started_at.asc())
    )
    breaks = result.scalars().all()
    return {
        "breaks": [
            {
                "id": str(b.id),
                "break_type": b.break_type.value,
                "started_at": b.started_at.isoformat() if b.started_at else None,
                "ended_at": b.ended_at.isoformat() if b.ended_at else None,
                "is_active": b.ended_at is None,
            }
            for b in breaks
        ]
    }


# ===========================================================================
# ROSTER -- monthly view, per-day shift CRUD
# ===========================================================================

@router.get("/roster")
async def get_monthly_roster(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
    year: int = Query(..., ge=2020, le=2100),
    month: int = Query(..., ge=1, le=12),
):
    doctor = await _get_doctor(db, current_user.sub)
    _, last_day = monthrange(year, month)
    month_start = date(year, month, 1)
    month_end = date(year, month, last_day)

    shifts_result = await db.execute(
        select(RosterShift).where(
            and_(
                RosterShift.doctor_id == doctor.id,
                RosterShift.shift_date >= month_start,
                RosterShift.shift_date <= month_end,
            )
        )
    )
    shifts = {s.shift_date.isoformat(): s for s in shifts_result.scalars().all()}

    holidays_result = await db.execute(
        select(Holiday).where(
            and_(
                Holiday.hospital_id == doctor.hospital_id,
                Holiday.holiday_date >= month_start,
                Holiday.holiday_date <= month_end,
            )
        )
    )
    holidays = {h.holiday_date.isoformat(): h.name for h in holidays_result.scalars().all()}

    leaves_result = await db.execute(
        select(DoctorLeave).where(
            and_(
                DoctorLeave.doctor_id == doctor.id,
                DoctorLeave.status == LeaveStatus.approved,
                DoctorLeave.start_date <= month_end,
                DoctorLeave.end_date >= month_start,
            )
        )
    )
    leave_ranges = leaves_result.scalars().all()

    days = []
    for d in range(1, last_day + 1):
        current = date(year, month, d)
        iso = current.isoformat()
        on_leave = any(l.start_date <= current <= l.end_date for l in leave_ranges)
        shift = shifts.get(iso)
        days.append(
            {
                "date": iso,
                "is_holiday": iso in holidays,
                "holiday_name": holidays.get(iso),
                "is_on_leave": on_leave,
                "shift_type": shift.shift_type.value if shift else None,
                "start_time": shift.start_time.strftime("%H:%M") if shift and shift.start_time else None,
                "end_time": shift.end_time.strftime("%H:%M") if shift and shift.end_time else None,
                "notes": shift.notes if shift else None,
            }
        )

    return {"year": year, "month": month, "days": days}


@router.put("/roster")
async def set_roster_shift(
    payload: RosterShiftPayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)

    valid_shift_types = [e.value for e in ShiftType]
    shift_type = payload.shift_type if payload.shift_type in valid_shift_types else "morning"

    result = await db.execute(
        select(RosterShift).where(
            and_(RosterShift.doctor_id == doctor.id, RosterShift.shift_date == payload.shift_date)
        )
    )
    shift = result.scalars().first()

    start_t = time.fromisoformat(payload.start_time) if payload.start_time else None
    end_t = time.fromisoformat(payload.end_time) if payload.end_time else None

    if shift:
        shift.shift_type = shift_type
        shift.start_time = start_t
        shift.end_time = end_t
        shift.notes = payload.notes
    else:
        shift = RosterShift(
            id=uuid.uuid4(),
            doctor_id=doctor.id,
            hospital_id=doctor.hospital_id,
            shift_date=payload.shift_date,
            shift_type=shift_type,
            start_time=start_t,
            end_time=end_t,
            notes=payload.notes,
        )
        db.add(shift)

    await db.commit()
    return success_response(message="Roster shift saved")


@router.delete("/roster/{shift_date}")
async def delete_roster_shift(
    shift_date: date,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    result = await db.execute(
        select(RosterShift).where(
            and_(RosterShift.doctor_id == doctor.id, RosterShift.shift_date == shift_date)
        )
    )
    shift = result.scalars().first()
    if shift:
        await db.delete(shift)
        await db.commit()
    return success_response(message="Roster shift removed")


# ===========================================================================
# HOLIDAYS -- hospital-wide calendar
# ===========================================================================

@router.get("/holidays")
async def get_holidays(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
    year: int = Query(..., ge=2020, le=2100),
):
    doctor = await _get_doctor(db, current_user.sub)
    result = await db.execute(
        select(Holiday)
        .where(
            and_(
                Holiday.hospital_id == doctor.hospital_id,
                func.extract("year", Holiday.holiday_date) == year,
            )
        )
        .order_by(Holiday.holiday_date.asc())
    )
    holidays = result.scalars().all()
    return {
        "holidays": [
            {
                "id": str(h.id),
                "date": h.holiday_date.isoformat(),
                "name": h.name,
                "is_full_day": h.is_full_day,
            }
            for h in holidays
        ]
    }


@router.post("/holidays")
async def create_holiday(
    payload: HolidayCreatePayload,
    current_user: Annotated[TokenPayload, Depends(require_role("doctor", "admin"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    holiday = Holiday(
        id=uuid.uuid4(),
        hospital_id=doctor.hospital_id,
        holiday_date=payload.holiday_date,
        name=payload.name,
        is_full_day=payload.is_full_day,
    )
    db.add(holiday)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        return error_response(
            error_code="HOLIDAY_EXISTS",
            message="A holiday is already set for this date.",
            status_code=409,
        )
    return success_response(message="Holiday added", status_code=201)


# ===========================================================================
# EARNINGS
# ===========================================================================

@router.get("/earnings")
async def get_earnings(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
    period: str = Query("month", description="week | month | year"),
):
    doctor = await _get_doctor(db, current_user.sub)

    period_days = {"week": 7, "month": 30, "year": 365}.get(period, 30)
    since = datetime.now(timezone.utc) - timedelta(days=period_days)

    result = await db.execute(
        select(func.count(Appointment.id)).where(
            and_(
                Appointment.doctor_id == doctor.id,
                Appointment.status == AppointmentStatus.completed,
                Appointment.scheduled_at >= since,
            )
        )
    )
    completed_count = result.scalar() or 0
    consultation_fee = doctor.consultation_fee or 0

    return {
        "period": period,
        "completed_consultations": completed_count,
        "consultation_fee": consultation_fee,
        "total_earnings": completed_count * consultation_fee,
        "currency": "INR",
    }


# ===========================================================================
# AVAILABILITY
# ===========================================================================

@router.get("/availability")
async def get_availability(
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    try:
        result = await db.execute(
            text("SELECT slots FROM doctor_availability WHERE doctor_id = :doc_id"),
            {"doc_id": str(doctor.id)},
        )
        row = result.first()
        if row:
            return {"slots": row.slots}
    except Exception as e:
        _logger.exception("Failed to fetch availability slots for doctor %s", doctor.id)
    return {"slots": []}


@router.put("/availability")
async def set_availability(
    slots: list[AvailabilitySlot],
    current_user: Annotated[TokenPayload, Depends(require_role("doctor"))],
    db: AsyncSession = Depends(get_db),
):
    doctor = await _get_doctor(db, current_user.sub)
    try:
        await db.execute(
            text(
                """
                INSERT INTO doctor_availability (doctor_id, slots, updated_at)
                VALUES (:doc_id, :slots, now())
                ON CONFLICT (doctor_id) DO UPDATE SET slots = :slots, updated_at = now()
                """
            ),
            {"doc_id": str(doctor.id), "slots": [s.model_dump() for s in slots]},
        )
        await db.commit()
    except Exception:
        await db.rollback()
        return error_response(
            error_code="AVAILABILITY_TABLE_MISSING",
            message="Availability storage is not provisioned for this deployment yet.",
            status_code=501,
        )
    return success_response(message="Availability updated")
