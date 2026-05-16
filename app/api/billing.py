from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List
import uuid
from datetime import datetime

from app.core.database import get_db
from app.api import deps
from app.models.models import Invoice, BillItem, Payment, Patient, RoleEnum, Hospital, PatientVisit, PaymentStatus
from app.schemas.billing import Invoice as InvoiceSchema, InvoiceCreate, PaymentCreate, PaymentResponse
from app.services.billing_service import BillingService
from app.utils.pdf_generator import InvoicePDFGenerator

router = APIRouter()

@router.get("/pending-visits")
async def get_pending_billing_visits(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    REVENUE RECOVERY:
    Fetches all hospital visits that have NOT yet been invoiced.
    """
    stmt = select(PatientVisit).outerjoin(Invoice).where(
        PatientVisit.hospital_id == hospital_id,
        Invoice.id == None
    ).order_by(PatientVisit.created_at.desc())
    
    result = await db.execute(stmt)
    visits = result.scalars().all()
    
    return [
        {
            "visit_id": v.id,
            "patient_id": v.patient_id,
            "visit_reason": v.visit_reason,
            "created_at": v.created_at,
            "department": v.department
        } for v in visits
    ]

@router.get("/my-invoices", response_model=List[InvoiceSchema])
async def get_my_invoices(
    db: AsyncSession = Depends(get_db),
    current_patient: Patient = Depends(deps.get_current_patient)
):
    """
    PATIENT ACCESS:
    Allows patients to retrieve their own itemized billing history.
    """
    invoices = await BillingService.get_patient_invoices(db, current_patient.id)
    return invoices

@router.post("/invoices", response_model=InvoiceSchema)
async def create_invoice(
    obj_in: InvoiceCreate,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    GENERATE CLINICAL INVOICE:
    Creates a master invoice and associated line items using the BillingService.
    """
    invoice = await BillingService.create_invoice(
        db=db,
        hospital_id=hospital_id,
        patient_id=obj_in.patient_id,
        visit_id=obj_in.visit_id,
        items_data=obj_in.items,
        notes=obj_in.notes
    )
    return invoice

@router.get("/invoices/{invoice_id}", response_model=InvoiceSchema)
async def get_invoice(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    stmt = select(Invoice).options(selectinload(Invoice.items)).where(
        Invoice.id == invoice_id, 
        Invoice.hospital_id == hospital_id
    )
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@router.post("/payments/{invoice_id}", response_model=PaymentResponse)
async def record_payment(
    invoice_id: uuid.UUID,
    obj_in: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    RECORD REVENUE:
    Applies a payment to an existing invoice.
    """
    try:
        payment = await BillingService.record_payment(db, invoice_id, obj_in)
        return payment
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/invoices/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(deps.get_current_user)
):
    """
    PROFESSIONAL PDF RECEIPT GENERATION:
    Streams a clinical-grade invoice PDF.
    """
    # 1. Fetch Invoice with deep relations
    stmt = select(Invoice).options(
        selectinload(Invoice.items)
    ).where(Invoice.id == invoice_id)
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # 2. Security Gating (Staff or Patient)
    # Note: hospital_id might be on staff_profile
    user_hospital_id = getattr(current_user.staff_profile, 'hospital_id', None) if current_user.staff_profile else None
    is_staff = user_hospital_id == invoice.hospital_id
    is_patient = current_user.id == invoice.patient_id
    
    if not (is_staff or is_patient):
        raise HTTPException(status_code=403, detail="Access denied to this financial record")

    # 3. Fetch Identity Details
    patient_stmt = select(Patient).where(Patient.id == invoice.patient_id)
    patient_res = await db.execute(patient_stmt)
    patient = patient_res.scalar_one_or_none()

    hospital_stmt = select(Hospital).where(Hospital.id == invoice.hospital_id)
    hospital_res = await db.execute(hospital_stmt)
    hospital = hospital_res.scalar_one_or_none()

    # 4. Generate & Stream (Using existing Utility)
    # Preparation for Generator (mapping to what it expects)
    invoice_dict = {
        "invoice_number": invoice.invoice_number,
        "date": invoice.created_at.strftime("%Y-%m-%d"),
        "status": invoice.status.value,
        "total_amount": invoice.total_amount,
        "tax_amount": invoice.tax_amount,
        "discount_amount": invoice.discount_amount,
        "payable_amount": invoice.payable_amount,
        "items": [
            {
                "description": item.description,
                "category": item.category,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "total_price": item.total_price
            } for item in invoice.items
        ]
    }

    pdf_buffer = InvoicePDFGenerator.generate(invoice_dict, hospital, patient)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=Invoice_{invoice.invoice_number}.pdf"}
    )
