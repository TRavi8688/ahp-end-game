import asyncio
import re

async def patch():
    with open("app/api/v1/endpoints/clinical.py", "r") as f:
        content = f.read()

    new_endpoints = """
@router.post("/prescriptions/{prescription_id}/share", status_code=status.HTTP_200_OK)
async def share_prescription(
    prescription_id: uuid.UUID,
    share_request: PrescriptionShareRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    \"\"\"
    Patient shares prescription with a specific Pharmacy.
    \"\"\"
    from app.models.models import Patient
    from sqlalchemy import select
    
    if current_user.role != RoleEnum.patient:
        raise HTTPException(status_code=403, detail="Only patients can share their prescriptions.")
        
    res = await db.execute(select(Patient).where(Patient.user_id == current_user.id))
    patient = res.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found.")
        
    try:
        req = await clinical_service.share_prescription(
            db=db,
            prescription_id=prescription_id,
            patient_id=patient.id,
            pharmacy_hospyn_id=share_request.pharmacy_id
        )
        await db.commit()
        return {"success": True, "message": "Prescription shared successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/prescriptions/{prescription_id}/dispense_partial", status_code=status.HTTP_200_OK)
async def dispense_partial_prescription(
    prescription_id: uuid.UUID,
    dispense_request: PartialDispenseRequest,
    db: AsyncSession = Depends(deps.get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    \"\"\"
    Pharmacy dispenses specific medicines and creates a rollover for unfulfilled ones.
    \"\"\"
    if current_user.role not in [RoleEnum.pharmacy, RoleEnum.admin] and not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="Unauthorized fulfillment.")
        
    try:
        prescription, rollover = await clinical_service.dispense_partial(
            db=db,
            prescription_id=prescription_id,
            pharmacist_id=current_user.id,
            hospital_id=hospital_id,
            items=dispense_request.items
        )
        await db.commit()
        return {
            "success": True, 
            "fulfilled_id": str(prescription.id), 
            "rollover_id": str(rollover.id) if rollover else None
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
"""

    if "def share_prescription" not in content:
        # insert before @router.post("/lab-orders"
        content = content.replace("@router.post(\"/lab-orders\"", new_endpoints + "\n@router.post(\"/lab-orders\"")
        with open("app/api/v1/endpoints/clinical.py", "w") as f:
            f.write(content)

if __name__ == "__main__":
    asyncio.run(patch())
