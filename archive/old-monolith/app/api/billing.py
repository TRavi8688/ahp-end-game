from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
import uuid
from datetime import datetime

from app.core.database import get_db
from app.api import deps
from app.models import models as app_models
from app.models.models import Invoice, BillItem, Payment, Patient, RoleEnum, Hospital, PatientVisit, PaymentStatus
from app.schemas.billing import Invoice as InvoiceSchema, InvoiceCreate, PaymentCreate, PaymentResponse
from app.services.billing_service import BillingService
from app.utils.pdf_generator import InvoicePDFGenerator
from app.core.audit import log_clinical_audit

from app.core.security import require_module

router = APIRouter(dependencies=[Depends(require_module("billing"))])


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
        notes=obj_in.notes,
        discount_amount=getattr(obj_in, "discount_amount", 0.0)
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
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user)
):
    """
    RECORD REVENUE:
    Applies a payment to an existing invoice.
    """
    try:
        payment, invoice = await BillingService.record_payment(db, invoice_id, obj_in)
        
        await log_clinical_audit(
            db=db,
            user_id=current_user.id,
            action="PAYMENT_RECEIVED",
            resource_type="INVOICE",
            resource_id=invoice.id,
            patient_id=invoice.patient_id,
            hospital_id=hospital_id,
            details={
                "amount": float(payment.amount),
                "method": payment.payment_method,
                "invoice_number": invoice.invoice_number
            }
        )
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

@router.get("/reception/op-payments")
async def get_op_payments_for_reception(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id),
    current_user = Depends(deps.get_current_user),
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    payment_method: Optional[str] = None,
    search: Optional[str] = None,
):
    """
    RECEPTIONIST BILLING LEDGER:
    Date-wise OP payment history with full filtering support.
    Filters: date_from, date_to (YYYY-MM-DD), payment_method, search (invoice/patient).
    """
    from datetime import date as date_type
    from sqlalchemy import and_, or_, cast, Date as SADate
    from sqlalchemy.orm import joinedload

    role_val = current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role)
    if role_val not in ["hospital_admin", "admin", "receptionist"]:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Build dynamic filters
    filters = [Invoice.hospital_id == hospital_id]

    if date_from:
        try:
            df = datetime.strptime(date_from, "%Y-%m-%d")
            filters.append(Invoice.created_at >= df)
        except ValueError:
            pass

    if date_to:
        try:
            dt = datetime.strptime(date_to, "%Y-%m-%d")
            from datetime import timedelta
            filters.append(Invoice.created_at < dt + timedelta(days=1))
        except ValueError:
            pass

    stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.items),
            selectinload(Invoice.payments)
        )
        .where(and_(*filters))
        .order_by(Invoice.created_at.desc())
        .limit(500)
    )
    result = await db.execute(stmt)
    invoices = result.scalars().all()

    # Load patient names
    patient_ids = list({inv.patient_id for inv in invoices})
    patient_name_map = {}
    if patient_ids:
        from app.models.models import Patient, User
        from sqlalchemy.orm import joinedload as jl
        p_stmt = select(Patient).options(jl(Patient.user)).where(Patient.id.in_(patient_ids))
        p_result = await db.execute(p_stmt)
        for pt in p_result.scalars().all():
            name = f"{pt.user.first_name} {pt.user.last_name}" if pt.user else "Unknown"
            patient_name_map[pt.id] = {"name": name, "hospyn_id": pt.hospyn_id}

    op_payments = []
    for inv in invoices:
        # Only OP/Consultation invoices
        is_op = any(item.item_category in ['Consultation', 'Registration', 'OPD'] for item in inv.items)
        if not is_op and inv.items:
            continue

        # Get payment method from linked payment record
        pay_method = "CASH"
        txn_id = None
        if inv.payments:
            pay = inv.payments[0]
            pay_method = pay.payment_method.value if hasattr(pay.payment_method, 'value') else str(pay.payment_method)
            txn_id = pay.provider_transaction_id

        # Apply payment method filter
        if payment_method and payment_method.upper() != pay_method.upper():
            continue

        pt_info = patient_name_map.get(inv.patient_id, {"name": "Unknown", "hospyn_id": ""})

        # Apply search filter
        if search:
            s = search.lower()
            if s not in inv.invoice_number.lower() and s not in pt_info["name"].lower() and s not in pt_info["hospyn_id"].lower():
                continue

        op_payments.append({
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "date": inv.created_at.isoformat(),
            "date_display": inv.created_at.strftime("%d %b %Y"),
            "time_display": inv.created_at.strftime("%I:%M %p"),
            "patient_name": pt_info["name"],
            "hospyn_id": pt_info["hospyn_id"],
            "total_amount": float(inv.total_amount),
            "payable_amount": float(inv.payable_amount),
            "paid_amount": float(inv.paid_amount or 0),
            "status": inv.status.value if hasattr(inv.status, 'value') else inv.status,
            "payment_method": pay_method,
            "transaction_id": txn_id,
            "items_summary": [i.item_name for i in inv.items],
        })

    return op_payments

