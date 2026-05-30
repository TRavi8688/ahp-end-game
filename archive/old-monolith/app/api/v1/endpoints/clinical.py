from typing import List, Optional
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
import app.api.deps as deps
from app.schemas.clinical import (
    PrescriptionCreate, 
    PrescriptionResponse,
    PrescriptionShareRequest,
    PartialDispenseRequest
)
from app.schemas.lab import (
    LabOrderCreate, 
    LabOrderResponse,
    LabStatusUpdate
)
from app.services.clinical_service import ClinicalService
from app.models.models import RoleEnum
from app.core.security import require_module

router = APIRouter()
clinical_service = ClinicalService()

@router.post("/prescriptions", response_model=PrescriptionResponse, status_code=status.HTTP_201_CREATED)
async def create_prescription(
    *,
    db: AsyncSession = Depends(deps.get_db),
    prescription_in: PrescriptionCreate,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Issue a new digital prescription. (Doctor only)
    """
    from sqlalchemy import select as sa_select
    from app.models.models import Doctor, Patient

    if current_user.role != RoleEnum.doctor:
        raise HTTPException(status_code=403, detail="Only doctors can issue prescriptions")
    
    # Eagerly load Doctor profile by user_id (avoids lazy-load 422 bug)
    stmt = sa_select(Doctor).where(Doctor.user_id == current_user.id)
    result = await db.execute(stmt)
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found. Please contact admin.")
        
    # Robust Patient ID Resolution (handles UUIDs, Hospyn IDs, and missing frontend data)
    final_patient_id = None
    try:
        if prescription_in.patient_id and prescription_in.patient_id not in ["null", "undefined", ""]:
            try:
                final_patient_id = uuid.UUID(prescription_in.patient_id)
            except ValueError:
                # It's a Hospyn ID (e.g. "Hospyn-D0AAB75D"), resolve it to UUID
                from sqlalchemy import func
                stmt_p = sa_select(Patient).where(func.lower(Patient.hospyn_id) == func.lower(prescription_in.patient_id))
                patient_res = await db.execute(stmt_p)
                patient_obj = patient_res.scalars().first()
                if patient_obj:
                    final_patient_id = patient_obj.id
                else:
                    raise HTTPException(status_code=404, detail="Patient not found in system")
        else:
            raise ValueError("Empty patient_id")
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Invalid patient_id format. Must be UUID or Hospyn ID. Got: {prescription_in.patient_id}")

    final_visit_id = None
    if prescription_in.visit_id and prescription_in.visit_id not in ["null", "undefined", ""]:
        try:
            final_visit_id = uuid.UUID(prescription_in.visit_id)
        except ValueError:
            pass

    try:
        prescription = await clinical_service.create_prescription(
            db=db,
            hospital_id=hospital_id,
            user_id=current_user.id,
            doctor_id=doctor.id,
            patient_id=final_patient_id,
            medications=[m.model_dump() for m in prescription_in.medications],
            notes=prescription_in.notes,
            diagnosis=prescription_in.diagnosis,
            visit_id=final_visit_id
        )
        await db.commit()
        return prescription
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prescriptions/{prescription_id}/fulfill", response_model=PrescriptionResponse)
async def fulfill_prescription(
    *,
    db: AsyncSession = Depends(deps.get_db),
    prescription_id: uuid.UUID,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Fulfill a digital prescription. (Pharmacist/Staff only)
    """
    # HARDENED RBAC: Only pharmacy or qualified staff
    if current_user.role not in [RoleEnum.pharmacy, RoleEnum.admin] and not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="Unauthorized fulfillment. Pharmacy credentials required.")
        
    try:
        return await clinical_service.fulfill_prescription(
            db=db,
            prescription_id=prescription_id,
            pharmacist_id=current_user.id,
            hospital_id=hospital_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/prescriptions/{prescription_id}/share", status_code=status.HTTP_200_OK)
async def share_prescription(
    prescription_id: uuid.UUID,
    share_request: PrescriptionShareRequest,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Patient shares prescription with a specific Pharmacy.
    """
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
    """
    Pharmacy dispenses specific medicines and creates a rollover for unfulfilled ones.
    """
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

@router.post("/lab-orders", response_model=LabOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_lab_order(
    *,
    db: AsyncSession = Depends(deps.get_db),
    order_in: LabOrderCreate,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user),
    _gate = Depends(require_module("labs"))
):
    """
    Create a new lab diagnostic order. (Doctor only)
    """
    from sqlalchemy import select as sa_select
    from app.models.models import Doctor

    if current_user.role != RoleEnum.doctor:
        raise HTTPException(status_code=403, detail="Only doctors can order lab tests")
    
    # Eagerly load Doctor profile
    stmt = sa_select(Doctor).where(Doctor.user_id == current_user.id)
    result = await db.execute(stmt)
    doctor = result.scalars().first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found. Please contact admin.")
    
    # Check if the lab tests exist
    from app.models.clinical import LabTestMaster
    tests_found = []
    
    for t_name in order_in.tests:
        stmt = sa_select(LabTestMaster).where(
            LabTestMaster.hospital_id == hospital_id,
            func.lower(LabTestMaster.test_name) == t_name.lower()
        )
        res = await db.execute(stmt)
        if res.scalar_one_or_none():
            tests_found.append(t_name)
            
    if not tests_found:
        raise HTTPException(status_code=400, detail="None of the requested tests are available in the hospital directory")

    order = await clinical_service.create_lab_order(
        db=db,
        hospital_id=hospital_id,
        user_id=current_user.id,
        doctor_id=doctor.id,
        patient_id=order_in.patient_id,
        tests=tests_found,
        history=order_in.clinical_history
    )
    
    return order

@router.get("/queue")
async def get_clinical_queue(
    db: AsyncSession = Depends(deps.get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Returns the live OPD queue with patient details for the Doctor's Visit Dashboard.
    """
    from sqlalchemy import select as sa_select
    from app.models.queue import QueueToken, QueueTokenStatus
    from app.models.core import Patient
    from app.models.models import PatientVisit
    
    # 1. Fetch WAITING tokens for this hospital
    stmt = sa_select(QueueToken, Patient, PatientVisit).join(
        Patient, QueueToken.patient_id == Patient.id
    ).outerjoin(
        PatientVisit, PatientVisit.patient_id == Patient.id
    ).where(
        QueueToken.hospital_id == hospital_id,
        QueueToken.status == QueueTokenStatus.WAITING
    ).order_by(QueueToken.priority_score.desc(), QueueToken.created_at.asc())
    
    result = await db.execute(stmt)
    rows = result.all()
    
    formatted_queue = []
    # Deduplicate by token id in case of multiple visits
    seen_tokens = set()
    
    for token, patient, visit in rows:
        if token.id in seen_tokens:
            continue
        seen_tokens.add(token.id)
        
        formatted_queue.append({
            "id": str(visit.id) if visit else str(token.id), # Fallback if no visit record
            "patient_id": str(patient.id),
            "patient_name": patient.full_name,
            "visit_reason": visit.visit_reason if visit else "General Consultation",
            "symptoms": visit.symptoms if visit else "None reported"
        })
        
    return formatted_queue

@router.get("/patients/{patient_id}/history", response_model=dict)
async def get_patient_history(
    patient_id: str,
    db: AsyncSession = Depends(deps.get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Fetch comprehensive clinical history for a patient (Visits, Prescriptions, Labs).
    """
    from sqlalchemy import select as sa_select
    from app.models.clinical import PatientVisit, Prescription, LabDiagnosticOrder, Patient
    
    # Resolve Patient ID
    try:
        final_patient_id = uuid.UUID(patient_id)
    except ValueError:
        from sqlalchemy import func
        stmt_p = sa_select(Patient).where(func.lower(Patient.hospyn_id) == func.lower(patient_id))
        patient_res = await db.execute(stmt_p)
        patient_obj = patient_res.scalars().first()
        if not patient_obj:
            raise HTTPException(status_code=404, detail="Patient not found")
        final_patient_id = patient_obj.id

    # 1. Fetch Visits
    v_stmt = sa_select(PatientVisit).where(PatientVisit.patient_id == final_patient_id).order_by(PatientVisit.created_at.desc())
    v_res = await db.execute(v_stmt)
    visits = v_res.scalars().all()
    
    # 2. Fetch Prescriptions
    p_stmt = sa_select(Prescription).where(Prescription.patient_id == final_patient_id).order_by(Prescription.created_at.desc())
    p_res = await db.execute(p_stmt)
    prescriptions = p_res.scalars().all()
    
    # 3. Fetch Lab Orders
    l_stmt = sa_select(LabDiagnosticOrder).where(LabDiagnosticOrder.patient_id == final_patient_id).order_by(LabDiagnosticOrder.created_at.desc())
    l_res = await db.execute(l_stmt)
    lab_orders = l_res.scalars().all()

    return {
        "visits": [{
            "id": str(v.id),
            "date": v.created_at.isoformat(),
            "reason": v.visit_reason,
            "symptoms": v.symptoms,
            "status": v.status.value
        } for v in visits],
        "prescriptions": [{
            "id": str(p.id),
            "date": p.created_at.isoformat(),
            "diagnosis": p.diagnosis,
            "medications": p.medications,
            "status": p.status.value
        } for p in prescriptions],
        "labs": [{
            "id": str(l.id),
            "date": l.created_at.isoformat(),
            "tests": l.tests_requested,
            "status": l.status.value,
            "results": l.results_data
        } for l in lab_orders]
    }

@router.patch("/lab-orders/{order_id}/status", response_model=LabOrderResponse)
async def update_lab_status(
    *,
    db: AsyncSession = Depends(deps.get_db),
    order_id: uuid.UUID,
    status_in: LabStatusUpdate,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user),
    _gate = Depends(require_module("labs"))
):
    """
    Update the status of a lab order. (Lab Staff/Doctor only)
    """
    if current_user.role not in [RoleEnum.nurse, RoleEnum.admin] and not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="Unauthorized status update")
        
    try:
        return await clinical_service.update_lab_status(
            db=db,
            order_id=order_id,
            status=status_in.status,
            hospital_id=hospital_id,
            user_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/lab-orders/{order_id}/record-results", response_model=LabOrderResponse)
async def record_lab_results(
    *,
    db: AsyncSession = Depends(deps.get_db),
    order_id: uuid.UUID,
    results_in: List[dict],
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user),
    _gate = Depends(require_module("labs"))
):
    """
    Record structured observations for a lab order.
    """
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="Unauthorized results recording")
        
    try:
        order = await clinical_service.record_lab_results(
            db=db,
            order_id=order_id,
            results_data=results_in,
            hospital_id=hospital_id,
            user_id=current_user.id
        )
        await db.commit()
        return order
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/records/{record_id}/verify", status_code=status.HTTP_200_OK)
async def verify_medical_record(
    *,
    db: AsyncSession = Depends(deps.get_db),
    record_id: uuid.UUID,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    Formally verify an AI-extracted medical record. (Doctor only)
    """
    if current_user.role != RoleEnum.doctor:
        raise HTTPException(status_code=403, detail="Only doctors can verify medical records")
        
    try:
        return await clinical_service.verify_medical_record(
            db=db,
            record_id=record_id,
            user_id=current_user.id,
            doctor_id=current_user.doctor_profile.id,
            hospital_id=hospital_id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/prescriptions", response_model=List[PrescriptionResponse])
async def get_prescriptions(
    patient_id: Optional[uuid.UUID] = None,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Get digital prescriptions list.
    - Patients get their own prescriptions.
    - Staff/Doctors get prescriptions for their tenant/hospital.
    """
    from app.models.models import DigitalPrescription, Patient
    from sqlalchemy import select

    if current_user.role == RoleEnum.patient:
        stmt_p = select(Patient).where(Patient.user_id == current_user.id)
        res_p = await db.execute(stmt_p)
        patient = res_p.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient profile not found.")
        stmt = select(DigitalPrescription).where(DigitalPrescription.patient_id == patient.id)
    else:
        hospital_id = await deps.get_hospital_id(current_user, db)
        stmt = select(DigitalPrescription).where(DigitalPrescription.hospital_id == hospital_id)
        if patient_id:
            stmt = stmt.where(DigitalPrescription.patient_id == patient_id)

    from sqlalchemy.orm import selectinload
    from app.models.models import Doctor, Hospital
    stmt = stmt.options(
        selectinload(DigitalPrescription.doctor).selectinload(Doctor.user),
        selectinload(DigitalPrescription.hospital)
    )

    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/prescriptions/{prescription_id}", response_model=PrescriptionResponse)
async def get_prescription(
    prescription_id: uuid.UUID,
    db: AsyncSession = Depends(deps.get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    Get details of a single digital prescription.
    """
    from app.models.models import DigitalPrescription, Patient
    from sqlalchemy import select

    stmt = select(DigitalPrescription).where(DigitalPrescription.id == prescription_id)
    if current_user.role == RoleEnum.patient:
        stmt_p = select(Patient).where(Patient.user_id == current_user.id)
        res_p = await db.execute(stmt_p)
        patient = res_p.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient profile not found.")
        stmt = stmt.where(DigitalPrescription.patient_id == patient.id)
    else:
        hospital_id = await deps.get_hospital_id(current_user, db)
        stmt = stmt.where(DigitalPrescription.hospital_id == hospital_id)

    from sqlalchemy.orm import selectinload
    from app.models.models import Doctor, Hospital
    stmt = stmt.options(
        selectinload(DigitalPrescription.doctor).selectinload(Doctor.user),
        selectinload(DigitalPrescription.hospital)
    )

    result = await db.execute(stmt)
    prescription = result.scalar_one_or_none()
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found.")
    return prescription
