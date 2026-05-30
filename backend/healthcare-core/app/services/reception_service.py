import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.walkin import WalkInRequest, QueueState, PriorityLevel, WalkInSource
from app.models.queue_event import QueueEvent
from app.models.payment_transaction import PaymentTransaction
from app.core.websockets import manager
from app.services.queue_service import (
    check_duplicate_walkin,
    generate_queue_number,
    transition_queue_state
)

class ReceptionService:
    """
    Orchestration layer for all reception workflows: manual entry, transitions, billing, and live syncing.
    """

    @staticmethod
    async def create_manual_walkin(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        staff_id: uuid.UUID,
        first_name: str,
        last_name: str,
        phone: str,
        age: int,
        gender: str,
        reason_for_visit: str,
        symptoms: Optional[str] = None,
        priority_level: str = "normal",
        hospyn_id: Optional[str] = None
    ) -> WalkInRequest:
        """
        Manually checks in a patient, logs the event, and broadcasts the update.
        If hospyn_id is provided, automatically links the WalkInRequest to the Patient.
        """
        # 0. Check Hospyn ID if provided
        patient_id = None
        if hospyn_id:
            from app.models.patient import Patient
            result = await db.execute(select(Patient).where(Patient.hospyn_id == hospyn_id))
            patient = result.scalars().first()
            if not patient:
                raise ValueError(f"No patient found with Hospyn ID: {hospyn_id}")
            patient_id = patient.id
            # Optionally override form with patient details if they were blank, but we'll just link the ID for now.

        # 1. Check for duplicates
        is_dup = await check_duplicate_walkin(db, phone, hospital_id)
        if is_dup:
            raise ValueError("This patient already has an active walk-in request.")

        # 2. Generate sequential daily queue number
        queue_number = await generate_queue_number(db, hospital_id)

        try:
            priority = PriorityLevel(priority_level)
        except ValueError:
            priority = PriorityLevel.normal

        # 3. Create walk-in request
        walkin = WalkInRequest(
            hospital_id=hospital_id,
            patient_id=patient_id,
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            phone=phone.strip(),
            age=age,
            gender=gender.strip(),
            reason_for_visit=reason_for_visit.strip(),
            symptoms=symptoms.strip() if symptoms else None,
            queue_state=QueueState.waiting_reception,
            priority_level=priority,
            source=WalkInSource.manual_reception,
            queue_number=queue_number,
            receptionist_id=staff_id,
            created_by_staff_id=staff_id,
            billing_status="pending",
            billing_amount=50000,  # default 500.00 INR (in paise)
        )
        db.add(walkin)
        await db.flush()

        # 4. Create audit event
        audit_event = QueueEvent(
            walkin_request_id=walkin.id,
            event_type="check_in",
            old_status=QueueState.waiting_reception.value,
            new_status=QueueState.waiting_reception.value,
            actor_user_id=staff_id,
            notes="Manual reception check-in created."
        )
        db.add(audit_event)
        await db.flush()

        # 5. Broadcast real-time update
        await manager.broadcast_to_hospital(
            hospital_id=str(hospital_id),
            event_type="walkin.created",
            data={
                "id": str(walkin.id),
                "queue_number": walkin.queue_number,
                "full_name": walkin.full_name,
                "phone": walkin.phone,
                "priority_level": walkin.priority_level.value,
                "queue_state": walkin.queue_state.value,
                "billing_status": walkin.billing_status
            }
        )

        return walkin

    @staticmethod
    async def process_payment(
        db: AsyncSession,
        walkin_id: uuid.UUID,
        hospital_id: uuid.UUID,
        staff_id: uuid.UUID,
        payment_method: str,
        transaction_reference: Optional[str] = None
    ) -> WalkInRequest:
        """
        Record a payment transaction for a walk-in, marks the walk-in billing as completed, and broadcasts updates.
        """
        # 1. Fetch walk-in
        query = select(WalkInRequest).where(
            WalkInRequest.id == walkin_id,
            WalkInRequest.hospital_id == hospital_id,
            WalkInRequest.deleted_at.is_(None)
        )
        result = await db.execute(query)
        walkin = result.scalars().first()
        if not walkin:
            raise ValueError("Walk-in request not found.")

        if walkin.billing_status == "paid":
            raise ValueError("Walk-in request has already been paid.")

        # 2. Record transaction
        transaction = PaymentTransaction(
            walkin_request_id=walkin.id,
            amount=walkin.billing_amount,
            payment_method=payment_method,
            status="completed",
            transaction_reference=transaction_reference,
            collected_by=staff_id
        )
        db.add(transaction)

        # 3. Update walk-in
        walkin.billing_status = "paid"
        walkin.payment_method = payment_method
        walkin.payment_reference = transaction_reference
        await db.flush()

        # 4. Log audit event
        audit_event = QueueEvent(
            walkin_request_id=walkin.id,
            event_type="payment",
            old_status=walkin.queue_state.value,
            new_status=walkin.queue_state.value,
            actor_user_id=staff_id,
            notes=f"Payment of {walkin.billing_amount / 100:.2f} collected via {payment_method}."
        )
        db.add(audit_event)
        await db.flush()

        # 5. Broadcast real-time update
        await manager.broadcast_to_hospital(
            hospital_id=str(hospital_id),
            event_type="walkin.paid",
            data={
                "id": str(walkin.id),
                "queue_number": walkin.queue_number,
                "full_name": walkin.full_name,
                "billing_status": walkin.billing_status,
                "payment_method": payment_method
            }
        )

        return walkin

    @staticmethod
    async def route_walkin(
        db: AsyncSession,
        walkin_id: uuid.UUID,
        hospital_id: uuid.UUID,
        staff_id: uuid.UUID,
        route_to: str,  # "triage" or "doctor"
        assigned_doctor_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None
    ) -> WalkInRequest:
        """
        Transition queue state of a walk-in, log the event, and broadcast the transition.
        """
        # Fetch walk-in
        query = select(WalkInRequest).where(
            WalkInRequest.id == walkin_id,
            WalkInRequest.hospital_id == hospital_id,
            WalkInRequest.deleted_at.is_(None)
        )
        result = await db.execute(query)
        walkin = result.scalars().first()
        if not walkin:
            raise ValueError("Walk-in request not found.")

        if walkin.queue_state != QueueState.waiting_reception:
            raise ValueError(f"Cannot route: current state is '{walkin.queue_state.value}', expected 'waiting_reception'.")

        target_state = QueueState.waiting_doctor if route_to == "doctor" else QueueState.waiting_triage
        
        # If routing to doctor, update assigned doctor ID
        if route_to == "doctor" and assigned_doctor_id:
            walkin.assigned_doctor_id = assigned_doctor_id

        # Update lifecycle timestamps and status
        await transition_queue_state(
            db=db,
            walkin=walkin,
            new_state=target_state,
            actor_id=str(staff_id),
            ip_address=ip_address
        )
        await db.flush()

        # Log audit event
        audit_event = QueueEvent(
            walkin_request_id=walkin.id,
            event_type="routing",
            old_status=QueueState.waiting_reception.value,
            new_status=target_state.value,
            actor_user_id=staff_id,
            notes=f"Routed patient to {route_to}."
        )
        db.add(audit_event)
        await db.flush()

        # Broadcast update
        await manager.broadcast_to_hospital(
            hospital_id=str(hospital_id),
            event_type="walkin.accepted",
            data={
                "id": str(walkin.id),
                "queue_number": walkin.queue_number,
                "full_name": walkin.full_name,
                "queue_state": walkin.queue_state.value,
                "assigned_doctor_id": str(walkin.assigned_doctor_id) if walkin.assigned_doctor_id else None
            }
        )

        return walkin
