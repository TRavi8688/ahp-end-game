"""
Billing & UPI Payment Routes
==============================
PHASE 2 FIX — Complete billing API ported from archive/old-monolith,
adapted to microservice structure with UPI deep-link support.

Endpoints:
  POST  /billing/invoice                        - Create invoice from appointment
  GET   /billing/invoice/{id}                   - Get invoice details
  GET   /billing/invoice/{id}/upi-url           - Get UPI deep-link URL
  PATCH /billing/invoice/{id}/mark-paid         - Mark as paid with UPI ref
  GET   /billing/invoice/{id}/receipt           - Generate PDF receipt
  GET   /billing/patient/{patient_id}/invoices  - List patient invoices
  GET   /billing/hospital/invoices              - List hospital invoices (owner)

HOW TO REGISTER:
  In backend/healthcare-core/app/api/router.py add:
    from app.api.v1.billing import router as billing_router
    router.include_router(billing_router, prefix="/billing", tags=["Billing"])
"""

import uuid
import io
from datetime import datetime, timezone
from typing import Annotated, Optional, List
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.patient import Patient
from app.models.appointment import Appointment, AppointmentStatus
from app.models.hospital import Hospital
from shared.utils.responses import success_response, error_response
from shared.audit import log_audit_event

router = APIRouter()


# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class InvoiceLineItemIn(BaseModel):
    description: str = Field(..., max_length=300)
    category: str = Field(..., max_length=100)  # consultation, pharmacy, lab, procedure
    quantity: float = Field(1.0, ge=0.01)
    unit_price: float = Field(..., ge=0)


class CreateInvoiceRequest(BaseModel):
    appointment_id: uuid.UUID
    line_items: Optional[List[InvoiceLineItemIn]] = None  # if None, auto-generate from appointment
    notes: Optional[str] = Field(None, max_length=1000)


class MarkPaidRequest(BaseModel):
    upi_transaction_ref: str = Field(..., min_length=4, max_length=100, description="UPI transaction ID from patient's GPay/PhonePe confirmation")


# ─── Helpers ──────────────────────────────────────────────────────────────────

async def _get_hospital_upi_vpa(hospital_id: uuid.UUID, db: AsyncSession) -> Optional[str]:
    """Fetch the hospital's UPI VPA from hospital_settings table."""
    try:
        from sqlalchemy import text
        result = await db.execute(
            text("SELECT upi_vpa FROM hospital_settings WHERE hospital_id = :hid LIMIT 1"),
            {"hid": str(hospital_id)},
        )
        row = result.fetchone()
        return row.upi_vpa if row and row.upi_vpa else None
    except Exception:
        return None


def _build_upi_url(vpa: str, name: str, amount: float, invoice_number: str, description: str) -> str:
    """
    Build NPCI-compliant UPI deep-link URL.
    When scanned, this opens GPay / PhonePe / Paytm / BHIM on the user's phone.

    Format: upi://pay?pa={VPA}&pn={Name}&am={Amount}&cu=INR&tn={Note}&tr={TxRef}
    """
    # Sanitise amount to exactly 2 decimal places
    amount_str = f"{amount:.2f}"
    # Sanitise description — UPI spec: max 50 chars, no special chars
    safe_desc = description[:50].replace("&", "and").replace("=", "-")
    # Transaction reference — your internal invoice number
    safe_ref = invoice_number.replace(" ", "-")[:50]
    # Payee name — max 50 chars
    safe_name = name[:50]

    upi_url = (
        f"upi://pay"
        f"?pa={quote(vpa)}"
        f"&pn={quote(safe_name)}"
        f"&am={amount_str}"
        f"&cu=INR"
        f"&tn={quote(safe_desc)}"
        f"&tr={quote(safe_ref)}"
    )
    return upi_url


async def _get_or_create_invoice_model(db: AsyncSession):
    """
    Dynamically get the Invoice model.
    Handles both old-monolith models.py and new microservice models.
    """
    try:
        from app.models.billing import Invoice, InvoiceLineItem, InvoiceStatus
        return Invoice, InvoiceLineItem, InvoiceStatus
    except ImportError:
        # Fallback: use raw SQL if model not yet migrated
        return None, None, None


# ─── POST /billing/invoice ────────────────────────────────────────────────────

@router.post("/invoice", status_code=201)
async def create_invoice(
    payload: CreateInvoiceRequest,
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("doctor", "receptionist", "hospital_admin", "admin")),
    ],
    db: AsyncSession = Depends(get_db),
):
    """
    Create an invoice for an appointment.
    - If line_items are provided, uses them directly.
    - If not, auto-generates from the appointment's prescription and procedures.
    """
    # Verify appointment exists
    appt_result = await db.execute(
        select(Appointment).where(
            Appointment.id == payload.appointment_id,
            Appointment.deleted_at.is_(None),
        )
    )
    appointment = appt_result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Verify appointment is completed before billing
    if appointment.status != AppointmentStatus.COMPLETED:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot create invoice for appointment with status {appointment.status.value}. "
                   "Appointment must be COMPLETED first.",
        )

    # Check no invoice already exists for this appointment
    try:
        from sqlalchemy import text
        existing = await db.execute(
            text("SELECT id FROM invoices WHERE appointment_id = :appt_id AND deleted_at IS NULL LIMIT 1"),
            {"appt_id": str(payload.appointment_id)},
        )
        if existing.fetchone():
            return error_response("INVOICE_EXISTS", "Invoice already exists for this appointment", 409)
    except Exception:
        pass  # Table may not exist yet — first invoice

    # Build line items
    line_items = payload.line_items or []
    if not line_items:
        # Auto-generate from appointment data
        if appointment.consultation_fee and float(appointment.consultation_fee) > 0:
            line_items.append(InvoiceLineItemIn(
                description="Consultation Fee",
                category="consultation",
                quantity=1.0,
                unit_price=float(appointment.consultation_fee),
            ))
        # Add prescription items if available
        if hasattr(appointment, "prescription_items") and appointment.prescription_items:
            for item in (appointment.prescription_items or []):
                line_items.append(InvoiceLineItemIn(
                    description=f"{item.get('drug_name', 'Medicine')} ({item.get('dosage', '')})",
                    category="pharmacy",
                    quantity=1.0,
                    unit_price=float(item.get("unit_price", 0)),
                ))

    if not line_items:
        # Minimum: create a zero consultation entry so invoice is not blank
        line_items.append(InvoiceLineItemIn(
            description="Consultation",
            category="consultation",
            quantity=1.0,
            unit_price=0.0,
        ))

    total_amount = sum(item.quantity * item.unit_price for item in line_items)

    # Generate invoice number: INV-YYYYMMDD-XXXX
    date_prefix = datetime.now(timezone.utc).strftime("%Y%m%d")
    try:
        from sqlalchemy import text
        count_result = await db.execute(
            text(f"SELECT COUNT(*) FROM invoices WHERE invoice_number LIKE 'INV-{date_prefix}-%'")
        )
        seq = (count_result.scalar() or 0) + 1
    except Exception:
        seq = 1
    invoice_number = f"INV-{date_prefix}-{seq:04d}"

    # Insert invoice using raw SQL to avoid model import issues
    invoice_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    try:
        from sqlalchemy import text
        await db.execute(
            text("""
                INSERT INTO invoices
                  (id, invoice_number, appointment_id, patient_id, hospital_id,
                   total_amount, status, notes, created_at, updated_at)
                VALUES
                  (:id, :inv_num, :appt_id, :patient_id, :hospital_id,
                   :total, 'PENDING', :notes, :now, :now)
            """),
            {
                "id": invoice_id,
                "inv_num": invoice_number,
                "appt_id": str(payload.appointment_id),
                "patient_id": str(appointment.patient_id),
                "hospital_id": str(appointment.hospital_id),
                "total": float(total_amount),
                "notes": payload.notes,
                "now": now,
            },
        )

        # Insert line items
        for item in line_items:
            await db.execute(
                text("""
                    INSERT INTO invoice_line_items
                      (id, invoice_id, description, category, quantity, unit_price, line_total, created_at)
                    VALUES
                      (:id, :inv_id, :desc, :cat, :qty, :unit_price, :line_total, :now)
                """),
                {
                    "id": str(uuid.uuid4()),
                    "inv_id": invoice_id,
                    "desc": item.description,
                    "cat": item.category,
                    "qty": item.quantity,
                    "unit_price": item.unit_price,
                    "line_total": item.quantity * item.unit_price,
                    "now": now,
                },
            )
        await db.flush()

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create invoice: {str(e)}")

    log_audit_event(
        action="invoice_created",
        actor_id=current_user.sub,
        target_id=invoice_id,
        details={"invoice_number": invoice_number, "total_amount": float(total_amount)},
    )

    return success_response(
        data={
            "invoice_id": invoice_id,
            "invoice_number": invoice_number,
            "total_amount": float(total_amount),
            "status": "PENDING",
            "created_at": now.isoformat(),
        },
        message="Invoice created successfully",
        status_code=201,
    )


# ─── GET /billing/invoice/{id} ────────────────────────────────────────────────

@router.get("/invoice/{invoice_id}")
async def get_invoice(
    invoice_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role(
        "patient", "doctor", "receptionist", "hospital_admin", "admin"
    ))],
    db: AsyncSession = Depends(get_db),
):
    """Get full invoice details including line items, hospital, and patient info."""
    try:
        from sqlalchemy import text

        inv_result = await db.execute(
            text("""
                SELECT
                    i.id, i.invoice_number, i.total_amount, i.status, i.notes,
                    i.upi_transaction_ref, i.paid_at, i.created_at, i.updated_at,
                    i.patient_id, i.hospital_id, i.appointment_id
                FROM invoices i
                WHERE i.id = :inv_id AND i.deleted_at IS NULL
                LIMIT 1
            """),
            {"inv_id": str(invoice_id)},
        )
        inv = inv_result.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    # RBAC: patients can only view their own invoices
    if current_user.role == "patient":
        patient_result = await db.execute(
            select(Patient).where(
                Patient.user_id == uuid.UUID(current_user.sub),
                Patient.id == inv.patient_id,
            )
        )
        if not patient_result.scalars().first():
            raise HTTPException(status_code=403, detail="Not authorised to view this invoice")

    # Get line items
    try:
        from sqlalchemy import text
        items_result = await db.execute(
            text("""
                SELECT description, category, quantity, unit_price, line_total
                FROM invoice_line_items
                WHERE invoice_id = :inv_id
                ORDER BY created_at ASC
            """),
            {"inv_id": str(invoice_id)},
        )
        line_items = [
            {
                "description": row.description,
                "category": row.category,
                "quantity": float(row.quantity),
                "unit_price": float(row.unit_price),
                "line_total": float(row.line_total),
            }
            for row in items_result.fetchall()
        ]
    except Exception:
        line_items = []

    # Get hospital details
    hospital_result = await db.execute(
        select(Hospital).where(Hospital.id == inv.hospital_id)
    )
    hospital = hospital_result.scalars().first()

    # Get UPI VPA for this hospital
    upi_vpa = await _get_hospital_upi_vpa(inv.hospital_id, db)

    return success_response(
        data={
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "total_amount": float(inv.total_amount),
            "status": inv.status,
            "notes": inv.notes,
            "upi_transaction_ref": inv.upi_transaction_ref,
            "paid_at": inv.paid_at.isoformat() if inv.paid_at else None,
            "created_at": inv.created_at.isoformat() if inv.created_at else None,
            "line_items": line_items,
            "hospital": {
                "id": str(hospital.id) if hospital else None,
                "name": hospital.name if hospital else "Hospital",
                "upi_vpa": upi_vpa,
                "phone": getattr(hospital, "phone", None),
                "address": getattr(hospital, "address", None),
            },
            "patient_id": str(inv.patient_id),
            "appointment_id": str(inv.appointment_id) if inv.appointment_id else None,
        },
        message="Invoice loaded",
    )


# ─── GET /billing/invoice/{id}/upi-url ───────────────────────────────────────

@router.get("/invoice/{invoice_id}/upi-url")
async def get_invoice_upi_url(
    invoice_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role(
        "patient", "doctor", "receptionist", "hospital_admin", "admin"
    ))],
    db: AsyncSession = Depends(get_db),
):
    """
    Returns the UPI deep-link URL for this invoice.

    The patient-app renders this as a QR code. When scanned, it opens
    GPay/PhonePe/Paytm/BHIM on the user's phone pointing to the hospital's UPI VPA.

    Example URL:
      upi://pay?pa=apollo@hdfcbank&pn=Apollo+Hospitals&am=1500.00&cu=INR&tn=Hospyn+Bill&tr=INV-20260603-0001
    """
    try:
        from sqlalchemy import text
        inv_result = await db.execute(
            text("SELECT invoice_number, total_amount, status, hospital_id FROM invoices WHERE id = :id AND deleted_at IS NULL"),
            {"id": str(invoice_id)},
        )
        inv = inv_result.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if inv.status == "PAID":
        return error_response("ALREADY_PAID", "This invoice has already been paid", 400)

    # Get hospital UPI VPA
    upi_vpa = await _get_hospital_upi_vpa(inv.hospital_id, db)
    if not upi_vpa:
        raise HTTPException(
            status_code=422,
            detail="Hospital has not configured a UPI VPA. Ask the hospital admin to add it in Hospital Settings.",
        )

    # Get hospital name
    hospital_result = await db.execute(
        select(Hospital).where(Hospital.id == inv.hospital_id)
    )
    hospital = hospital_result.scalars().first()
    hospital_name = hospital.name if hospital else "Hospyn Hospital"

    upi_url = _build_upi_url(
        vpa=upi_vpa,
        name=hospital_name,
        amount=float(inv.total_amount),
        invoice_number=inv.invoice_number,
        description=f"Hospyn Bill {inv.invoice_number}",
    )

    return success_response(
        data={
            "upi_url": upi_url,
            "invoice_number": inv.invoice_number,
            "amount": float(inv.total_amount),
            "hospital_name": hospital_name,
            "upi_vpa": upi_vpa,
            "instructions": "Scan the QR code with GPay, PhonePe, Paytm, or any UPI app to pay directly to the hospital.",
        },
        message="UPI payment URL generated",
    )


# ─── GET /billing/invoice/{id}/upi-qr ────────────────────────────────────────

@router.get("/invoice/{invoice_id}/upi-qr")
async def get_invoice_upi_qr(
    invoice_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role(
        "patient", "doctor", "receptionist", "hospital_admin", "admin"
    ))],
    db: AsyncSession = Depends(get_db),
):
    """
    Returns a Base64 encoded QR Code image of the UPI deep-link URL for this invoice.
    The frontend can render this directly in an <img src="data:image/png;base64,..."> tag.
    """
    import base64
    import io
    try:
        import qrcode
    except ImportError:
        raise HTTPException(status_code=500, detail="qrcode library is not installed. Add qrcode[pil] to requirements.txt.")

    try:
        from sqlalchemy import text
        inv_result = await db.execute(
            text("SELECT invoice_number, total_amount, status, hospital_id FROM invoices WHERE id = :id AND deleted_at IS NULL"),
            {"id": str(invoice_id)},
        )
        inv = inv_result.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if inv.status == "PAID":
        return error_response("ALREADY_PAID", "This invoice has already been paid", 400)

    # Get hospital UPI VPA
    upi_vpa = await _get_hospital_upi_vpa(inv.hospital_id, db)
    if not upi_vpa:
        raise HTTPException(
            status_code=422,
            detail="Hospital has not configured a UPI VPA. Ask the hospital admin to add it in Hospital Settings.",
        )

    # Get hospital name
    hospital_result = await db.execute(
        select(Hospital).where(Hospital.id == inv.hospital_id)
    )
    hospital = hospital_result.scalars().first()
    hospital_name = hospital.name if hospital else "Hospyn Hospital"

    upi_url = _build_upi_url(
        vpa=upi_vpa,
        name=hospital_name,
        amount=float(inv.total_amount),
        invoice_number=inv.invoice_number,
        description=f"Hospyn Bill {inv.invoice_number}",
    )

    # Generate QR Code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(upi_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_base64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    qr_data_uri = f"data:image/png;base64,{qr_base64}"

    return success_response(
        data={
            "upi_url": upi_url,
            "qr_code_base64": qr_data_uri,
            "invoice_number": inv.invoice_number,
            "amount": float(inv.total_amount),
            "hospital_name": hospital_name,
            "upi_vpa": upi_vpa,
            "instructions": "Scan this QR code with any UPI app to pay directly.",
        },
        message="UPI QR Code generated successfully",
    )


# ─── PATCH /billing/invoice/{id}/mark-paid ───────────────────────────────────

@router.patch("/invoice/{invoice_id}/mark-paid")
async def mark_invoice_paid(
    invoice_id: uuid.UUID,
    payload: MarkPaidRequest,
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("receptionist", "hospital_admin", "admin", "patient")),
    ],
    db: AsyncSession = Depends(get_db),
):
    """
    Mark an invoice as paid after UPI payment.
    The receptionist enters the UPI transaction reference from the patient's GPay/PhonePe.

    Reception portal calls this after patient shows payment confirmation.
    """
    try:
        from sqlalchemy import text

        # Verify invoice exists
        inv_result = await db.execute(
            text("SELECT id, status, total_amount, invoice_number FROM invoices WHERE id = :id AND deleted_at IS NULL"),
            {"id": str(invoice_id)},
        )
        inv = inv_result.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if inv.status == "PAID":
        return error_response("ALREADY_PAID", "Invoice is already marked as paid", 400)

    now = datetime.now(timezone.utc)
    try:
        from sqlalchemy import text
        await db.execute(
            text("""
                UPDATE invoices
                SET status = 'PAID',
                    upi_transaction_ref = :ref,
                    paid_at = :now,
                    updated_at = :now
                WHERE id = :id
            """),
            {
                "ref": payload.upi_transaction_ref,
                "now": now,
                "id": str(invoice_id),
            },
        )
        await db.flush()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update invoice: {e}")

    log_audit_event(
        action="invoice_marked_paid",
        actor_id=current_user.sub,
        target_id=str(invoice_id),
        details={
            "invoice_number": inv.invoice_number,
            "upi_transaction_ref": payload.upi_transaction_ref,
            "amount": float(inv.total_amount),
        },
    )

    return success_response(
        data={
            "invoice_id": str(invoice_id),
            "invoice_number": inv.invoice_number,
            "status": "PAID",
            "upi_transaction_ref": payload.upi_transaction_ref,
            "paid_at": now.isoformat(),
            "amount": float(inv.total_amount),
        },
        message="Payment recorded. Invoice marked as PAID.",
    )


# ─── GET /billing/invoice/{id}/receipt ───────────────────────────────────────

@router.get("/invoice/{invoice_id}/receipt")
async def download_receipt(
    invoice_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role(
        "patient", "doctor", "receptionist", "hospital_admin", "admin"
    ))],
    db: AsyncSession = Depends(get_db),
):
    """
    Generate and return a PDF receipt for a paid invoice.
    Uses reportlab. If reportlab is not installed, returns a JSON fallback.

    Add to requirements.txt: reportlab>=4.0.0
    """
    try:
        from sqlalchemy import text
        inv_result = await db.execute(
            text("""
                SELECT i.id, i.invoice_number, i.total_amount, i.status,
                       i.upi_transaction_ref, i.paid_at, i.created_at,
                       i.patient_id, i.hospital_id
                FROM invoices i
                WHERE i.id = :id AND i.deleted_at IS NULL
            """),
            {"id": str(invoice_id)},
        )
        inv = inv_result.fetchone()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if inv.status != "PAID":
        raise HTTPException(status_code=400, detail="Receipt only available for paid invoices")

    # Get line items
    try:
        from sqlalchemy import text
        items_result = await db.execute(
            text("SELECT description, category, quantity, unit_price, line_total FROM invoice_line_items WHERE invoice_id = :id"),
            {"id": str(invoice_id)},
        )
        line_items = items_result.fetchall()
    except Exception:
        line_items = []

    # Get hospital
    hospital_result = await db.execute(select(Hospital).where(Hospital.id == inv.hospital_id))
    hospital = hospital_result.scalars().first()
    hospital_name = hospital.name if hospital else "Hospital"
    hospital_address = f"{hospital.address_line1 or ''}, {hospital.city or ''}, {hospital.state or ''}".strip(", ") if hospital else ""
    hospital_phone = hospital.phone if hospital else ""
    hospital_gstin = ""

    try:
        from app.utils.pdf_engine import build_invoice_pdf, InvoiceData, InvoiceLineItem

        invoice_data = InvoiceData(
            invoice_number=inv.invoice_number,
            issued_at=inv.paid_at or inv.created_at or datetime.now(),
            pharmacy_name=hospital_name,
            pharmacy_address=hospital_address,
            pharmacy_phone=hospital_phone,
            pharmacy_gstin=hospital_gstin,
            invoice_type="Tax Invoice / Receipt",
            payment_method=inv.upi_transaction_ref and "UPI" or "",
            payment_ref=inv.upi_transaction_ref or "",
            status="PAID" if inv.status == "PAID" else inv.status,
            items=[
                InvoiceLineItem(
                    description=row.description,
                    category=row.category or "",
                    quantity=float(row.quantity),
                    unit_price=float(row.unit_price),
                    tax_percent=5.0,
                )
                for row in line_items
            ],
        )

        buf = build_invoice_pdf(invoice_data)

        return Response(
            content=buf.read(),
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="HOSPAIN-{inv.invoice_number}.pdf"'},
        )

    except ImportError:
        return success_response(
            data={
                "invoice_number": inv.invoice_number,
                "status": inv.status,
                "total_amount": float(inv.total_amount),
                "note": "Install reportlab>=4.0.0 to enable PDF generation.",
            },
            message="PDF not available — reportlab not installed",
        )


# ─── GET /billing/patient/{patient_id}/invoices ───────────────────────────────

@router.get("/patient/{patient_id}/invoices")
async def list_patient_invoices(
    patient_id: uuid.UUID,
    current_user: Annotated[TokenPayload, Depends(require_role(
        "patient", "doctor", "receptionist", "hospital_admin", "admin"
    ))],
    status: Optional[str] = Query(None, description="Filter by status: PENDING, PAID, CANCELLED"),
    db: AsyncSession = Depends(get_db),
):
    """
    List all invoices for a patient.
    Patients can only view their own invoices (RBAC enforced).
    Used by patient-app BillingScreen.js.
    """
    # RBAC: patients can only see their own invoices
    if current_user.role == "patient":
        patient_result = await db.execute(
            select(Patient).where(
                Patient.user_id == uuid.UUID(current_user.sub),
                Patient.deleted_at.is_(None),
            )
        )
        patient = patient_result.scalars().first()
        if not patient or patient.id != patient_id:
            raise HTTPException(status_code=403, detail="Not authorised to view these invoices")

    try:
        from sqlalchemy import text
        query = """
            SELECT id, invoice_number, total_amount, status, created_at, paid_at, appointment_id
            FROM invoices
            WHERE patient_id = :patient_id AND deleted_at IS NULL
        """
        params: dict = {"patient_id": str(patient_id)}
        if status:
            query += " AND status = :status"
            params["status"] = status.upper()
        query += " ORDER BY created_at DESC"

        result = await db.execute(text(query), params)
        rows = result.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    invoices = [
        {
            "id": str(row.id),
            "invoice_number": row.invoice_number,
            "total_amount": float(row.total_amount),
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "paid_at": row.paid_at.isoformat() if row.paid_at else None,
            "appointment_id": str(row.appointment_id) if row.appointment_id else None,
        }
        for row in rows
    ]

    return success_response(
        data={
            "invoices": invoices,
            "total_count": len(invoices),
            "pending_count": sum(1 for i in invoices if i["status"] == "PENDING"),
            "paid_count": sum(1 for i in invoices if i["status"] == "PAID"),
        },
        message="Patient invoices loaded",
    )


# ─── GET /billing/hospital/invoices ──────────────────────────────────────────

@router.get("/hospital/invoices")
async def list_hospital_invoices(
    current_user: Annotated[
        TokenPayload,
        Depends(require_role("hospital_admin", "admin", "receptionist")),
    ],
    date_from: Optional[str] = Query(None, description="ISO date: 2026-06-01"),
    date_to: Optional[str] = Query(None, description="ISO date: 2026-06-30"),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    List all invoices for a hospital. Used by Owner Dashboard ledger view.
    Hospital scoping is enforced via current_user's hospital_id.
    """
    # Get hospital_id from the staff profile of the current user
    try:
        from sqlalchemy import text
        staff_result = await db.execute(
            text("SELECT hospital_id FROM staff WHERE user_id = :uid AND deleted_at IS NULL LIMIT 1"),
            {"uid": current_user.sub},
        )
        staff_row = staff_result.fetchone()
        hospital_id = str(staff_row.hospital_id) if staff_row else None
    except Exception:
        hospital_id = None

    if not hospital_id:
        raise HTTPException(status_code=403, detail="Not linked to a hospital")

    try:
        from sqlalchemy import text
        query = """
            SELECT i.id, i.invoice_number, i.total_amount, i.status,
                   i.created_at, i.paid_at, i.patient_id, i.upi_transaction_ref
            FROM invoices i
            WHERE i.hospital_id = :hospital_id AND i.deleted_at IS NULL
        """
        params: dict = {"hospital_id": hospital_id}

        if status:
            query += " AND i.status = :status"
            params["status"] = status.upper()
        if date_from:
            query += " AND i.created_at >= :date_from"
            params["date_from"] = date_from
        if date_to:
            query += " AND i.created_at <= :date_to"
            params["date_to"] = date_to

        # Count total
        count_result = await db.execute(text(f"SELECT COUNT(*) FROM ({query}) AS q"), params)
        total_count = count_result.scalar() or 0

        query += " ORDER BY i.created_at DESC LIMIT :limit OFFSET :offset"
        params["limit"] = per_page
        params["offset"] = (page - 1) * per_page

        result = await db.execute(text(query), params)
        rows = result.fetchall()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    invoices = [
        {
            "id": str(row.id),
            "invoice_number": row.invoice_number,
            "total_amount": float(row.total_amount),
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "paid_at": row.paid_at.isoformat() if row.paid_at else None,
            "patient_id": str(row.patient_id),
            "upi_transaction_ref": row.upi_transaction_ref,
        }
        for row in rows
    ]

    total_revenue = sum(i["total_amount"] for i in invoices if i["status"] == "PAID")

    return success_response(
        data={
            "invoices": invoices,
            "total_count": total_count,
            "page": page,
            "per_page": per_page,
            "total_pages": max(1, (total_count + per_page - 1) // per_page),
            "summary": {
                "total_revenue_filtered": total_revenue,
                "pending_count": sum(1 for i in invoices if i["status"] == "PENDING"),
                "paid_count": sum(1 for i in invoices if i["status"] == "PAID"),
            },
        },
        message="Hospital invoices loaded",
    )
