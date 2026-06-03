import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
import uuid

async def patch():
    with open("app/services/clinical_service.py", "r") as f:
        content = f.read()

    new_methods = """
    async def share_prescription(
        self,
        db: AsyncSession,
        prescription_id: uuid.UUID,
        patient_id: uuid.UUID,
        pharmacy_hospyn_id: str
    ):
        from app.models.models import DigitalPrescription, Hospital, PartnerPharmacyRequest, PartnerReferralStatusEnum
        from sqlalchemy import select
        
        # Verify prescription belongs to patient
        res = await db.execute(select(DigitalPrescription).where(DigitalPrescription.id == prescription_id, DigitalPrescription.patient_id == patient_id))
        prescription = res.scalar_one_or_none()
        if not prescription:
            raise ValueError("Prescription not found or access denied")
            
        # Find pharmacy
        res = await db.execute(select(Hospital).where(Hospital.hospyn_id == pharmacy_hospyn_id))
        pharmacy = res.scalar_one_or_none()
        if not pharmacy:
            raise ValueError("Pharmacy not found")
            
        # Create share request
        req = PartnerPharmacyRequest(
            prescription_id=prescription.id,
            referring_hospital_id=prescription.hospital_id,
            partner_pharmacy_id=pharmacy.id,
            patient_id=patient_id,
            status=PartnerReferralStatusEnum.pending
        )
        db.add(req)
        return req

    async def dispense_partial(
        self,
        db: AsyncSession,
        prescription_id: uuid.UUID,
        pharmacist_id: uuid.UUID,
        hospital_id: uuid.UUID,
        items: list
    ):
        from app.models.models import DigitalPrescription, PrescriptionStatusEnum, PartnerPharmacyRequest, PartnerReferralStatusEnum
        from sqlalchemy import select
        import datetime
        import uuid
        import json
        import hashlib
        
        # 1. Fetch prescription
        res = await db.execute(select(DigitalPrescription).where(DigitalPrescription.id == prescription_id))
        prescription = res.scalar_one_or_none()
        if not prescription:
            raise ValueError("Prescription not found")
            
        # 2. Match items
        medications = prescription.medications
        fulfilled_meds = []
        remaining_meds = []
        
        items_dict = {item.name: item.action for item in items}
        
        for med in medications:
            action = items_dict.get(med['name'], 'decline')
            if action == 'accept':
                med['status'] = 'fulfilled'
                fulfilled_meds.append(med)
            else:
                med['status'] = 'pending'
                remaining_meds.append(med)
                
        # 3. Update original prescription
        prescription.medications = fulfilled_meds
        prescription.status = PrescriptionStatusEnum.fulfilled
        prescription.fulfilled_at = datetime.datetime.now()
        prescription.pharmacist_id = pharmacist_id
        
        # 4. Update PartnerPharmacyRequest if it exists
        res_req = await db.execute(select(PartnerPharmacyRequest).where(
            PartnerPharmacyRequest.prescription_id == prescription_id,
            PartnerPharmacyRequest.partner_pharmacy_id == hospital_id
        ))
        req = res_req.scalar_one_or_none()
        if req:
            req.status = PartnerReferralStatusEnum.fulfilled
            
        # 5. Create Rollover Prescription if remaining items exist
        rollover = None
        if remaining_meds:
            payload = {
                "hospital_id": str(prescription.hospital_id),
                "doctor_id": str(prescription.doctor_id),
                "patient_id": str(prescription.patient_id),
                "visit_id": str(prescription.visit_id) if prescription.visit_id else None,
                "diagnosis": f"{prescription.diagnosis} (Rollover)",
                "medications": remaining_meds,
                "timestamp": datetime.datetime.now().isoformat()
            }
            signature_hash = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
            
            rollover = DigitalPrescription(
                hospital_id=prescription.hospital_id,
                doctor_id=prescription.doctor_id,
                patient_id=prescription.patient_id,
                visit_id=prescription.visit_id,
                diagnosis=f"{prescription.diagnosis} (Rollover)" if prescription.diagnosis else "Rollover Prescription",
                medications=remaining_meds,
                notes=prescription.notes,
                qr_code_id=f"Hospyn-PR-{uuid.uuid4().hex[:8].upper()}",
                signature_hash=signature_hash,
                status=PrescriptionStatusEnum.pending
            )
            db.add(rollover)
            
        return prescription, rollover
"""

    if "def share_prescription" not in content:
        content = content.replace("    async def create_lab_order(", new_methods + "\n    async def create_lab_order(")
        with open("app/services/clinical_service.py", "w") as f:
            f.write(content)

if __name__ == "__main__":
    asyncio.run(patch())
