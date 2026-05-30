import uuid
from typing import Optional, List, Dict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.doctor import Doctor, DoctorStatus
from app.models.walkin import WalkInRequest, QueueState, PriorityLevel

class QueueRoutingService:
    """
    Intelligent routing system to balance doctor workload and match patient requirements.
    """
    @staticmethod
    async def get_doctor_loads(db: AsyncSession, hospital_id: uuid.UUID) -> Dict[uuid.UUID, int]:
        """
        Calculates the active load (waiting_doctor or in_consultation) for all active doctors in the hospital.
        """
        # Fetch count of active requests for each doctor
        query = (
            select(
                WalkInRequest.assigned_doctor_id,
                func.count(WalkInRequest.id)
            )
            .where(
                WalkInRequest.hospital_id == hospital_id,
                WalkInRequest.queue_state.in_([QueueState.waiting_doctor, QueueState.in_consultation]),
                WalkInRequest.deleted_at.is_(None),
                WalkInRequest.assigned_doctor_id.is_not(None)
            )
            .group_by(WalkInRequest.assigned_doctor_id)
        )
        
        result = await db.execute(query)
        loads = {row[0]: row[1] for row in result.all()}
        return loads

    @staticmethod
    async def suggest_doctor(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        specialization: Optional[str] = None,
        priority_level: Optional[PriorityLevel] = None
    ) -> Optional[Doctor]:
        """
        Auto-suggests the best doctor based on specialization, status (must be active),
        and active workload (waiting + consultation queue length).
        """
        # 1. Fetch active, approved doctors for this hospital
        doctor_query = select(Doctor).where(
            Doctor.hospital_id == hospital_id,
            Doctor.status == DoctorStatus.active,
            Doctor.is_active == True,
            Doctor.deleted_at.is_(None)
        )
        
        if specialization:
            # Case insensitive search on specialization
            doctor_query = doctor_query.where(
                Doctor.specialization.ilike(f"%{specialization}%")
            )
            
        doctors_result = await db.execute(doctor_query)
        doctors = doctors_result.scalars().all()
        
        if not doctors:
            # If a specific specialization was requested but no doctor found, fallback to any active doctor
            if specialization:
                fallback_query = select(Doctor).where(
                    Doctor.hospital_id == hospital_id,
                    Doctor.status == DoctorStatus.active,
                    Doctor.is_active == True,
                    Doctor.deleted_at.is_(None)
                )
                doctors_result = await db.execute(fallback_query)
                doctors = doctors_result.scalars().all()
                
        if not doctors:
            return None

        # 2. Get active loads
        loads = await QueueRoutingService.get_doctor_loads(db, hospital_id)
        
        # 3. Score doctors: primary sort by active load (ascending), secondary sort by experience (descending)
        # Low workload first, higher experience first if workloads are equal
        def score_doctor(doc: Doctor):
            doc_load = loads.get(doc.id, 0)
            return (doc_load, -getattr(doc, 'years_of_experience', 0))

        sorted_doctors = sorted(doctors, key=score_doctor)
        return sorted_doctors[0]
