from typing import List, Optional, Dict, Any
from datetime import datetime
import hashlib
import json
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import (
    DigitalPrescription, 
    LabDiagnosticOrder, 
    PrescriptionStatusEnum, 
    LabOrderStatusEnum,
    OutboxEvent,
    AuditLog,
    ClinicalEvent
)
from app.core.audit import log_audit_action
from app.services.base import BaseService
from app.services.event_service import event_service
from app.services.rules_engine import rules_engine
from app.models.models import LabResult

class ClinicalService(BaseService):
    """
    Enterprise Clinical Service Layer.
    Handles high-integrity operations for prescriptions and diagnostic orders.
    Implements digital signatures and transactional outbox events.
    """

    async def create_prescription(
        self, 
        db: AsyncSession, 
        hospital_id: int, 
        doctor_id: int, 
        patient_id: int, 
        medications: List[Dict[str, Any]], 
        notes: Optional[str] = None
    ) -> DigitalPrescription:
        # 1. Generate unique QR ID for this prescription
        qr_code_id = f"Hospyn-PR-{uuid.uuid4().hex[:8].upper()}"
        
        # 2. Generate Digital Signature (HMAC-like hash of payload)
        payload = {
            "hospital_id": hospital_id,
            "doctor_id": doctor_id,
            "patient_id": patient_id,
            "medications": medications,
            "timestamp": datetime.now().isoformat()
        }
        signature_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        
        # 3. Create prescription record
        prescription = DigitalPrescription(
            hospital_id=hospital_id,
            doctor_id=doctor_id,
            patient_id=patient_id,
            medications=medications,
            notes=notes,
            qr_code_id=qr_code_id,
            signature_hash=signature_hash,
            status=PrescriptionStatusEnum.pending
        )
        db.add(prescription)
        await db.flush() # Get ID
        
        # 4. Log Immutable Clinical Event
        await event_service.log_event(
            db=db,
            tenant_id=hospital_id,
            patient_id=patient_id,
            actor_id=doctor_id,
            event_type="PRESCRIPTION_CREATED",
            aggregate_type="prescription",
            aggregate_id=str(prescription.id),
            payload={
                "medications": medications,
                "qr_code_id": qr_code_id,
                "notes_provided": notes is not None
            }
        )
        
        # 5. Legacy Outbox Trigger (for WebSocket real-time updates)
        db.add(OutboxEvent(
            event_type="PRESCRIPTION_CREATED",
            event_version="v1",
            tenant_id=hospital_id,
            payload={"prescription_id": prescription.id, "patient_id": patient_id}
        ))
        
        # 5. Audit Logging
        await self._audit(db, doctor_id, hospital_id, "CREATE", "prescription", prescription.id)
        
        return prescription

    async def fulfill_prescription(
        self, 
        db: AsyncSession, 
        prescription_id: int, 
        pharmacist_id: int,
        hospital_id: int
    ) -> DigitalPrescription:
        result = await db.execute(
            select(DigitalPrescription).filter(
                DigitalPrescription.id == prescription_id,
                DigitalPrescription.hospital_id == hospital_id
            )
        )
        prescription = result.scalar()
        
        if not prescription:
            raise ValueError("Prescription not found or tenant mismatch")
            
        if prescription.status != PrescriptionStatusEnum.pending:
            raise ValueError(f"Prescription is already {prescription.status}")
            
        prescription.status = PrescriptionStatusEnum.fulfilled
        prescription.fulfilled_at = datetime.now()
        prescription.pharmacist_id = pharmacist_id
        
        # Trigger Immutable Event
        await event_service.log_event(
            db=db,
            tenant_id=hospital_id,
            patient_id=prescription.patient_id,
            actor_id=pharmacist_id,
            event_type="PRESCRIPTION_FULFILLED",
            aggregate_type="prescription",
            aggregate_id=str(prescription.id),
            payload={"pharmacist_id": pharmacist_id}
        )

        # Trigger Outbox for Patient App Notification
        db.add(OutboxEvent(
            event_type="PRESCRIPTION_FULFILLED",
            event_version="v1",
            tenant_id=hospital_id,
            payload={"prescription_id": prescription.id, "patient_id": prescription.patient_id}
        ))
        
        await self._audit(db, pharmacist_id, hospital_id, "FULFILL", "prescription", prescription.id)
        return prescription

    async def create_lab_order(
        self, 
        db: AsyncSession, 
        hospital_id: int, 
        doctor_id: int, 
        patient_id: int, 
        tests: List[str],
        history: Optional[str] = None
    ) -> LabDiagnosticOrder:
        order = LabDiagnosticOrder(
            hospital_id=hospital_id,
            doctor_id=doctor_id,
            patient_id=patient_id,
            tests={"items": tests},
            clinical_history=history,
            status=LabOrderStatusEnum.ordered
        )
        db.add(order)
        await db.flush()
        
        # Log Immutable Event
        await event_service.log_event(
            db=db,
            tenant_id=hospital_id,
            patient_id=patient_id,
            actor_id=doctor_id,
            event_type="LAB_ORDER_CREATED",
            aggregate_type="lab_order",
            aggregate_id=str(order.id),
            payload={"tests": tests}
        )

        db.add(OutboxEvent(
            event_type="LAB_ORDER_CREATED",
            event_version="v1",
            tenant_id=hospital_id,
            payload={"order_id": order.id, "patient_id": patient_id}
        ))
        
        await self._audit(db, doctor_id, hospital_id, "CREATE", "lab_order", order.id)
        return order

    async def update_lab_status(
        self, 
        db: AsyncSession, 
        order_id: int, 
        status: LabOrderStatusEnum,
        hospital_id: int,
        user_id: int
    ) -> LabDiagnosticOrder:
        result = await db.execute(
            select(LabDiagnosticOrder).filter(
                LabDiagnosticOrder.id == order_id,
                LabDiagnosticOrder.hospital_id == hospital_id
            )
        )
        order = result.scalar()
        
        if not order:
            raise ValueError("Lab order not found")
            
        order.status = status
        if status == LabOrderStatusEnum.completed:
            order.completed_at = datetime.now()
            
        # Log Immutable Event
        await event_service.log_event(
            db=db,
            tenant_id=hospital_id,
            patient_id=order.patient_id,
            actor_id=user_id,
            event_type="LAB_STATUS_UPDATED",
            aggregate_type="lab_order",
            aggregate_id=str(order.id),
            payload={"status": status.value}
        )

        db.add(OutboxEvent(
            event_type="LAB_STATUS_UPDATED",
            event_version="v1",
            tenant_id=hospital_id,
            payload={"order_id": order.id, "status": status.value}
        ))
        
        await self._audit(db, user_id, hospital_id, "UPDATE_STATUS", "lab_order", order.id)
        return order

    async def record_lab_results(
        self,
        db: AsyncSession,
        order_id: int,
        results_data: List[Dict[str, Any]],
        hospital_id: int,
        user_id: int
    ) -> LabDiagnosticOrder:
        """
        Records structured metrics for a lab order and triggers intelligence rules.
        """
        # 1. Fetch Order
        result = await db.execute(
            select(LabDiagnosticOrder).filter(
                LabDiagnosticOrder.id == order_id,
                LabDiagnosticOrder.hospital_id == hospital_id
            )
        )
        order = result.scalar()
        if not order:
            raise ValueError("Lab order not found")

        # 2. Save Structured Observations
        for r in results_data:
            res_obj = LabResult(
                order_id=order.id,
                test_name=r["test_name"],
                value=r["value"],
                unit=r["unit"],
                reference_range_min=r.get("min"),
                reference_range_max=r.get("max"),
                flag=r.get("flag")
            )
            db.add(res_obj)

        # 3. Update Order Status
        order.status = LabOrderStatusEnum.completed
        order.completed_at = datetime.now()

        # 4. Log Immutable Event
        await event_service.log_event(
            db=db,
            tenant_id=hospital_id,
            patient_id=order.patient_id,
            actor_id=user_id,
            event_type="LAB_COMPLETED",
            aggregate_type="lab_order",
            aggregate_id=str(order.id),
            payload={
                "result_count": len(results_data),
                "summary": [f"{r['test_name']}: {r['value']} {r['unit']}" for r in results_data]
            }
        )

        # 5. Trigger Rules Engine (Anomaly Detection)
        await rules_engine.process_lab_results(
            db=db,
            tenant_id=hospital_id,
            patient_id=order.patient_id,
            order_id=order.id,
            results=results_data,
            actor_id=user_id
        )

        # 6. Legacy Outbox for Notifications
        db.add(OutboxEvent(
            event_type="LAB_COMPLETED",
            event_version="v1",
            tenant_id=hospital_id,
            payload={"order_id": order.id, "patient_id": order.patient_id}
        ))

        await self._audit(db, user_id, hospital_id, "RECORD_RESULTS", "lab_order", order.id)
        return order

    async def _audit(self, db: AsyncSession, user_id: int, hospital_id: int, action: str, entity: str, entity_id: int):
        await log_audit_action(
            db=db,
            action=action,
            user_id=user_id,
            resource_type=entity,
            resource_id=entity_id,
            details={"hospital_id": hospital_id}
        )

    async def verify_medical_record(
        self,
        db: AsyncSession,
        record_id: int,
        doctor_id: uuid.UUID,
        hospital_id: int
    ) -> Any:
        """
        DOCTOR VERIFICATION: Formally sign off on an AI-analyzed medical record.
        """
        from app.models.models import MedicalRecord
        
        result = await db.execute(
            select(MedicalRecord).filter(MedicalRecord.id == record_id)
        )
        record = result.scalar()
        
        if not record:
            raise ValueError("Medical record not found")
            
        record.needs_verification = False
        record.verified_by_id = doctor_id
        record.verified_at = datetime.now()
        
        # Log Immutable Clinical Event
        await event_service.log_event(
            db=db,
            tenant_id=hospital_id,
            patient_id=record.patient_id,
            actor_id=str(doctor_id),
            event_type="RECORD_VERIFIED",
            aggregate_type="medical_record",
            aggregate_id=str(record.id),
            payload={"verified_by": str(doctor_id)}
        )
        
        await self._audit(db, doctor_id, hospital_id, "VERIFY", "medical_record", record.id)
        return record
