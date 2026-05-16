import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.models import (
    LabDiagnosticOrder, LabResult, LabOrderStatusEnum, 
    Patient, MedicalRecord, RecordTypeEnum
)
from app.core.realtime import manager

logger = logging.getLogger(__name__)

class LabService:
    @staticmethod
    async def create_order(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        doctor_id: uuid.UUID,
        patient_id: uuid.UUID,
        tests: List[Dict[str, Any]],
        visit_id: Optional[uuid.UUID] = None
    ) -> LabDiagnosticOrder:
        """
        DOCTOR COMMAND:
        Creates a new diagnostic request for a patient.
        """
        order = LabDiagnosticOrder(
            hospital_id=hospital_id,
            doctor_id=doctor_id,
            patient_id=patient_id,
            visit_id=visit_id,
            tests=tests,
            status=LabOrderStatusEnum.ordered
        )
        db.add(order)
        await db.commit()
        await db.refresh(order)
        
        logger.info(f"LAB_ORDER_CREATED: id={order.id} patient={patient_id}")
        return order

    @staticmethod
    async def upload_results(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        order_id: uuid.UUID,
        results_data: List[Dict[str, Any]],
        staff_id: uuid.UUID
    ) -> List[LabResult]:
        """
        LAB TECHNICIAN ACTION:
        Uploads structured results and binds them to the patient's record.
        """
        # 1. Verify Order
        stmt = select(LabDiagnosticOrder).where(
            LabDiagnosticOrder.id == order_id, 
            LabDiagnosticOrder.hospital_id == hospital_id
        )
        result = await db.execute(stmt)
        order = result.scalar_one_or_none()
        if not order:
            raise ValueError("Lab order not found")

        # 2. Create LabResult records
        lab_results = []
        for res in results_data:
            lab_res = LabResult(
                hospital_id=hospital_id,
                order_id=order_id,
                patient_id=order.patient_id,
                test_name=res["test_name"],
                value=res["value"],
                unit=res.get("unit"),
                reference_range=res.get("reference_range"),
                is_abnormal=res.get("is_abnormal", False),
                clinical_remarks=res.get("clinical_remarks")
            )
            db.add(lab_res)
            lab_results.append(lab_res)

        # 3. Update Order Status
        order.status = LabOrderStatusEnum.completed
        order.completed_at = datetime.now(timezone.utc)

        # 4. Bind to Medical Records (Forensic Health Passport)
        record = MedicalRecord(
            hospital_id=hospital_id,
            patient_id=order.patient_id,
            record_type=RecordTypeEnum.lab_report,
            title=f"Lab Report: {datetime.now().strftime('%Y-%m-%d')}",
            is_verified=True,
            uploader_id=staff_id
        )
        db.add(record)
        await db.flush()
        order.report_id = record.id

        await db.commit()
        
        # 5. Notify Patient (Real-time)
        await manager.broadcast_to_user(
            str(order.patient_id),
            {
                "type": "LAB_RESULT_READY",
                "order_id": str(order_id),
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        )

        logger.info(f"LAB_RESULTS_BOUND: order={order_id} patient={order.patient_id}")
        return lab_results
