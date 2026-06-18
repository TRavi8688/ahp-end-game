"""
B-3: Surgery / OT API Routes
Place at: backend/healthcare-core/app/api/v1/surgery.py

Then in backend/healthcare-core/app/api/router.py add:
    from app.api.v1.surgery import router as surgery_router
    api_router.include_router(surgery_router, prefix="/surgery", tags=["Surgery & OT"])
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SAEnum
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta
import enum

router = APIRouter()


# ── Status enum ───────────────────────────────────────────────
class SurgeryStatus(str, enum.Enum):
    scheduled = "scheduled"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"


# ── Pydantic schemas ─────────────────────────────────────────

class ScheduleSurgeryRequest(BaseModel):
    patient_id: int
    doctor_id: int
    ot_room: str              # e.g. "OT-1", "OT-2"
    scheduled_time: datetime
    procedure_name: str
    estimated_duration_minutes: Optional[int] = 90
    notes: Optional[str] = None


class UpdateSurgeryStatusRequest(BaseModel):
    status: SurgeryStatus
    notes: Optional[str] = None


class SurgeryResponse(BaseModel):
    id: int
    patient_id: int
    doctor_id: int
    ot_room: str
    scheduled_time: datetime
    procedure_name: str
    estimated_duration_minutes: int
    status: str
    notes: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ── DB dependency (use your existing get_db) ─────────────────
def get_db():
    """Replace with your actual get_db from app.database."""
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ── Auth dependency (use your existing get_current_user) ─────
def get_current_user(db: Session = Depends(get_db)):
    """Replace with your actual auth dependency."""
    from app.core.auth import get_current_user as _get_current_user
    return _get_current_user


# ── Surgery model reference ───────────────────────────────────
def _get_surgery_model():
    """Import the Surgery model — adjust path if needed."""
    try:
        from app.models.surgery import Surgery
        return Surgery
    except ImportError:
        # Fallback: define inline if model doesn't exist yet
        from app.database import Base
        class Surgery(Base):
            __tablename__ = "surgeries"
            id = Column(Integer, primary_key=True, index=True)
            patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
            doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=False)
            ot_room = Column(String(50), nullable=False)
            scheduled_time = Column(DateTime, nullable=False)
            procedure_name = Column(String(255), nullable=False)
            estimated_duration_minutes = Column(Integer, default=90)
            status = Column(String(50), default="scheduled")
            notes = Column(Text, nullable=True)
            created_at = Column(DateTime, default=datetime.utcnow)
        return Surgery


# ─────────────────────────────────────────────────────────────
# ENDPOINTS
# ─────────────────────────────────────────────────────────────

@router.post("/schedule", response_model=SurgeryResponse, status_code=status.HTTP_201_CREATED)
async def schedule_surgery(
    body: ScheduleSurgeryRequest,
    db: Session = Depends(get_db),
):
    """Schedule a new surgery in an OT room."""
    Surgery = _get_surgery_model()

    # Check OT room conflict
    conflict = db.query(Surgery).filter(
        Surgery.ot_room == body.ot_room,
        Surgery.status.in_(["scheduled", "in_progress"]),
        Surgery.scheduled_time.between(
            body.scheduled_time - timedelta(minutes=body.estimated_duration_minutes or 90),
            body.scheduled_time + timedelta(minutes=body.estimated_duration_minutes or 90),
        ),
    ).first()

    if conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"OT room {body.ot_room} is already booked at that time (surgery #{conflict.id})",
        )

    surgery = Surgery(
        patient_id=body.patient_id,
        doctor_id=body.doctor_id,
        ot_room=body.ot_room,
        scheduled_time=body.scheduled_time,
        procedure_name=body.procedure_name,
        estimated_duration_minutes=body.estimated_duration_minutes or 90,
        notes=body.notes,
        status="scheduled",
        created_at=datetime.utcnow(),
    )
    db.add(surgery)
    db.commit()
    db.refresh(surgery)
    return surgery


@router.get("/upcoming", response_model=list[SurgeryResponse])
async def get_upcoming_surgeries(
    db: Session = Depends(get_db),
):
    """List all surgeries scheduled in the next 7 days."""
    Surgery = _get_surgery_model()
    now = datetime.utcnow()
    seven_days = now + timedelta(days=7)

    surgeries = db.query(Surgery).filter(
        Surgery.scheduled_time.between(now, seven_days),
        Surgery.status.in_(["scheduled", "in_progress"]),
    ).order_by(Surgery.scheduled_time).all()

    return surgeries


@router.patch("/{surgery_id}/status", response_model=SurgeryResponse)
async def update_surgery_status(
    surgery_id: int,
    body: UpdateSurgeryStatusRequest,
    db: Session = Depends(get_db),
):
    """Update the status of a surgery."""
    Surgery = _get_surgery_model()
    surgery = db.query(Surgery).filter(Surgery.id == surgery_id).first()

    if not surgery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Surgery not found")

    # Validate status transition
    valid_transitions = {
        "scheduled": ["in_progress", "cancelled"],
        "in_progress": ["completed", "cancelled"],
        "completed": [],
        "cancelled": [],
    }
    if body.status not in valid_transitions.get(surgery.status, []):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Cannot transition from '{surgery.status}' to '{body.status}'",
        )

    surgery.status = body.status
    if body.notes:
        surgery.notes = (surgery.notes or "") + f"\n[{datetime.utcnow().isoformat()}] {body.notes}"
    db.commit()
    db.refresh(surgery)
    return surgery


@router.get("/{surgery_id}", response_model=SurgeryResponse)
async def get_surgery(
    surgery_id: int,
    db: Session = Depends(get_db),
):
    """Get full details for a single surgery."""
    Surgery = _get_surgery_model()
    surgery = db.query(Surgery).filter(Surgery.id == surgery_id).first()
    if not surgery:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Surgery not found")
    return surgery


@router.get("/ot-availability")
async def ot_availability(
    date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List OT rooms with their booked slots for a given date (default: today).
    Returns which rooms are free and which are booked by hour.
    """
    Surgery = _get_surgery_model()

    # Default to today
    target_date = datetime.utcnow().date()
    if date:
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="date must be in YYYY-MM-DD format",
            )

    day_start = datetime.combine(target_date, datetime.min.time())
    day_end = datetime.combine(target_date, datetime.max.time())

    booked = db.query(Surgery).filter(
        Surgery.scheduled_time.between(day_start, day_end),
        Surgery.status.in_(["scheduled", "in_progress"]),
    ).all()

    # Build room schedule
    rooms = {}
    for s in booked:
        if s.ot_room not in rooms:
            rooms[s.ot_room] = []
        rooms[s.ot_room].append({
            "surgery_id": s.id,
            "procedure": s.procedure_name,
            "start": s.scheduled_time.isoformat(),
            "end": (s.scheduled_time + timedelta(minutes=s.estimated_duration_minutes)).isoformat(),
            "status": s.status,
        })

    return {
        "date": target_date.isoformat(),
        "ot_rooms": rooms,
        "total_booked": len(booked),
    }
