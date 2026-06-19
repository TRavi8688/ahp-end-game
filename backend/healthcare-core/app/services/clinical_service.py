import uuid
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.walkin import WalkInRequest, QueueState
from app.models.medical_record import MedicalRecord
from app.models.prescription import Prescription, PrescriptionItem
from app.models.queue_event import QueueEvent
from app.core.websockets import manager
from app.services.queue_service import transition_queue_state


class ClinicalService:
    """
    Orchestrates doctor consultations, medical record generation, structured prescribing,
    and pharmacy integration routing.
    """

    @staticmethod
    async def complete_consultation(
        db: AsyncSession,
        walkin_id: uuid.UUID,
        doctor_id: uuid.UUID,
        chief_complaint: str,
        clinical_notes: str,
        diagnosis: str,
        prescription_items: List[Dict[str, Any]],
    ) -> MedicalRecord:
        """
        Processes clinical consultation completion:
        1. Compiles patient's MedicalRecord (with notes & diagnosis).
        2. Generates structured Prescription details (without exposing clinical notes).
        3. Sets WalkInRequest status to Completed.
        4. Triggers WebSocket live updates for real-time dashboards (doctor & pharmacy).
        """
        # 1. Fetch and validate walk-in request
        query = select(WalkInRequest).where(
            WalkInRequest.id == walkin_id, WalkInRequest.deleted_at.is_(None)
        )
        result = await db.execute(query)
        walkin = result.scalars().first()
        if not walkin:
            raise ValueError("Walk-in request not found.")

        if walkin.queue_state != QueueState.in_consultation:
            raise ValueError(
                f"Walk-in request is not currently in consultation. State: {walkin.queue_state.value}"
            )

        # Ensure patient_id is present (or simulate patient profile lookup/creation)
        if not walkin.patient_id:
            # Fallback if receptionist has not fully linked a Patient profile
            # In a real environment, we'd search or auto-create a patient record.
            # For simplicity, if not present, lookup patient by phone or raise
            from app.models.patient import Patient

            pat_query = select(Patient).where(
                Patient.phone == walkin.phone, Patient.deleted_at.is_(None)
            )
            pat_res = await db.execute(pat_query)
            pat = pat_res.scalars().first()
            if pat:
                walkin.patient_id = pat.id
            else:
                raise ValueError(
                    "Consultation cannot be completed: Patient profile has not been created or linked yet."
                )

        # 2. Create the patient's internal medical record
        record_text = f"Chief Complaint: {chief_complaint}\nDiagnosis: {diagnosis}\nNotes: {clinical_notes}"
        medical_record = MedicalRecord(
            patient_id=walkin.patient_id,
            record_name=f"Consultation Summary - {datetime.now().strftime('%d %b %Y')}",
            hospital_name=walkin.hospital.name if walkin.hospital else "Hospin Clinics",
            record_type="prescription",
            raw_text=record_text,
            ai_summary=diagnosis,
            patient_summary=f"Consultation with Dr. {walkin.assigned_doctor_id or 'General Physician'}",
        )
        db.add(medical_record)
        await db.flush()

        # 3. Create the structured prescription (if items are supplied)
        prescription = None
        if prescription_items:
            prescription = Prescription(
                walkin_request_id=walkin.id,
                patient_id=walkin.patient_id,
                doctor_id=doctor_id,
                status="pending",
            )
            db.add(prescription)
            await db.flush()

            for item in prescription_items:
                p_item = PrescriptionItem(
                    prescription_id=prescription.id,
                    drug_name=item["drug_name"],
                    dosage=item["dosage"],
                    frequency=item["frequency"],
                    duration=item["duration"],
                    instructions=item.get("instructions"),
                )
                db.add(p_item)
            await db.flush()

        # 4. Transition walk-in request queue state to completed
        await transition_queue_state(
            db=db,
            walkin=walkin,
            new_state=QueueState.completed,
            actor_id=str(doctor_id),
        )
        await db.flush()

        # Log queue event
        audit_event = QueueEvent(
            walkin_request_id=walkin.id,
            event_type="consultation_complete",
            old_status=QueueState.in_consultation.value,
            new_status=QueueState.completed.value,
            actor_user_id=doctor_id,
            notes=f"Consultation completed. Prescription generated: {prescription is not None}",
        )
        db.add(audit_event)
        await db.flush()

        # 5. Broadcast real-time WebSocket events (exclude diagnosis details to preserve privacy in pharmacy order)
        items_payload = []
        if prescription_items:
            for item in prescription_items:
                items_payload.append(
                    {
                        "drug_name": item["drug_name"],
                        "dosage": item["dosage"],
                        "frequency": item["frequency"],
                        "duration": item["duration"],
                        "instructions": item.get("instructions"),
                    }
                )

        # Sync doctor queue update
        await manager.broadcast_to_hospital(
            hospital_id=str(walkin.hospital_id),
            event_type="walkin.completed",
            data={
                "id": str(walkin.id),
                "queue_number": walkin.queue_number,
                "full_name": walkin.full_name,
                "queue_state": walkin.queue_state.value,
            },
        )

        # Notify pharmacy endpoint queue (routing prescription metadata only)
        if prescription:
            await manager.broadcast_to_hospital(
                hospital_id=str(walkin.hospital_id),
                event_type="prescription.created",
                data={
                    "prescription_id": str(prescription.id),
                    "walkin_request_id": str(walkin.id),
                    "patient_name": walkin.full_name,
                    "phone": walkin.phone,
                    "items": items_payload,
                },
            )

        return medical_record
