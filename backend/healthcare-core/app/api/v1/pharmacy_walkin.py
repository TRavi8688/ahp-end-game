"""
backend/healthcare-core/app/api/v1/pharmacy_walkin.py

Backs the Walk-In tab (Screens 10-16): Customer Details -> Prescription
Upload (optional, stored but not yet OCR'd — see TODO) -> Medicine Entry ->
Billing Cart -> Payment -> Bill Success.

Endpoints:
  POST /pharmacy/walkin-customers          - create/find a walk-in customer
  GET  /pharmacy/walkin-customers/search    - search by name/phone
  POST /pharmacy/sales                      - checkout: cart -> invoice
  GET  /pharmacy/sales                      - recent bills / order history
  GET  /pharmacy/sales/{id}                 - one bill (for Bill Success replay)
  GET  /pharmacy/sales/{id}/pdf             - downloadable invoice PDF
"""

import io
import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.pharmacy import (
    WalkInCustomer, PharmacySale, PharmacySaleItem, PaymentMethod,
    PharmacyInventory, PharmacyTransaction, TransactionType,
)
from app.models.hospital import Hospital
from app.api.v1.pharmacy import _resolve_pharmacy_hospital_id, PHARMACY_ROLES

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class WalkInCustomerIn(BaseModel):
    name: str
    phone: str


class SaleLine(BaseModel):
    inventory_item_id: str
    quantity: int = Field(gt=0)


class CheckoutRequest(BaseModel):
    walkin_customer_id: Optional[str] = None
    patient_id: Optional[str] = None
    items: List[SaleLine]
    payment_method: str  # cash | upi | card


def _invoice_number() -> str:
    return f"INV-{datetime.now(timezone.utc):%Y%m%d}-{uuid.uuid4().hex[:6].upper()}"


def _sale_to_dict(sale: PharmacySale) -> dict:
    return {
        "id": str(sale.id),
        "invoice_number": sale.invoice_number,
        "patient_id": str(sale.patient_id) if sale.patient_id else None,
        "walkin_customer_id": str(sale.walkin_customer_id) if sale.walkin_customer_id else None,
        "subtotal": float(sale.subtotal),
        "gst_amount": float(sale.gst_amount),
        "total": float(sale.total),
        "payment_method": sale.payment_method.value if sale.payment_method else None,
        "created_at": sale.created_at.isoformat() if sale.created_at else None,
        "items": [
            {
                "medicine_name": item.medicine_name,
                "quantity": item.quantity,
                "unit_price": float(item.unit_price),
                "line_total": float(item.unit_price) * item.quantity,
            }
            for item in (sale.items or [])
        ],
    }


# ── POST /pharmacy/walkin-customers ──────────────────────────────────────────

@router.post("/walkin-customers", status_code=status.HTTP_201_CREATED)
async def create_walkin_customer(
    payload: WalkInCustomerIn,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)

    # Reuse an existing walk-in record for the same phone at this pharmacy
    # rather than creating a fresh one every visit.
    existing = await db.execute(
        select(WalkInCustomer).where(
            WalkInCustomer.hospital_id == hospital_id,
            WalkInCustomer.phone == payload.phone,
        )
    )
    customer = existing.scalars().first()
    if customer:
        customer.name = payload.name or customer.name
    else:
        customer = WalkInCustomer(
            id=uuid.uuid4(), hospital_id=hospital_id, name=payload.name, phone=payload.phone,
        )
        db.add(customer)
    await db.flush()
    await db.refresh(customer)

    return {"id": str(customer.id), "name": customer.name, "phone": customer.phone}


@router.get("/walkin-customers/search")
async def search_walkin_customers(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
    q: str = Query(..., min_length=2),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    like = f"%{q}%"
    result = await db.execute(
        select(WalkInCustomer).where(
            WalkInCustomer.hospital_id == hospital_id,
            or_(WalkInCustomer.name.ilike(like), WalkInCustomer.phone.ilike(like)),
        ).limit(10)
    )
    return [{"id": str(c.id), "name": c.name, "phone": c.phone} for c in result.scalars().all()]


# ── POST /pharmacy/sales (checkout) ──────────────────────────────────────────

@router.post("/sales", status_code=status.HTTP_201_CREATED)
async def checkout(
    payload: CheckoutRequest,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)

    if not payload.items:
        raise HTTPException(status_code=400, detail="Cart is empty.")
    if not payload.walkin_customer_id and not payload.patient_id:
        raise HTTPException(status_code=400, detail="A customer or patient is required.")
    try:
        payment_method = PaymentMethod(payload.payment_method)
    except ValueError:
        raise HTTPException(status_code=400, detail="payment_method must be cash, upi, or card.")

    lines = []
    subtotal = Decimal("0.00")
    for line in payload.items:
        try:
            inv_id = uuid.UUID(line.inventory_item_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid inventory_item_id: {line.inventory_item_id}")

        inv_result = await db.execute(
            select(PharmacyInventory).options(selectinload(PharmacyInventory.medicine)).where(
                and_(PharmacyInventory.id == inv_id, PharmacyInventory.hospital_id == hospital_id)
            )
        )
        inventory = inv_result.scalars().first()
        if not inventory:
            raise HTTPException(status_code=404, detail=f"Inventory item {line.inventory_item_id} not found.")
        if inventory.quantity_available < line.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {inventory.medicine.name if inventory.medicine else 'item'} "
                       f"— only {inventory.quantity_available} left.",
            )
        line_total = (inventory.selling_price or Decimal("0.00")) * line.quantity
        subtotal += line_total
        lines.append((inventory, line.quantity, line_total))

    gst_amount = (subtotal * Decimal("0.05")).quantize(Decimal("0.01"))
    total = subtotal + gst_amount

    sale = PharmacySale(
        id=uuid.uuid4(),
        hospital_id=hospital_id,
        invoice_number=_invoice_number(),
        patient_id=uuid.UUID(payload.patient_id) if payload.patient_id else None,
        walkin_customer_id=uuid.UUID(payload.walkin_customer_id) if payload.walkin_customer_id else None,
        subtotal=subtotal,
        gst_amount=gst_amount,
        total=total,
        payment_method=payment_method,
        created_by=uuid.UUID(current_user.sub),
    )
    db.add(sale)
    await db.flush()

    for inventory, qty, line_total in lines:
        inventory.quantity_available -= qty
        db.add(PharmacySaleItem(
            id=uuid.uuid4(),
            sale_id=sale.id,
            inventory_item_id=inventory.id,
            medicine_name=inventory.medicine.name if inventory.medicine else "Item",
            quantity=qty,
            unit_price=inventory.selling_price,
        ))
        db.add(PharmacyTransaction(
            id=uuid.uuid4(),
            hospital_id=hospital_id,
            inventory_item_id=inventory.id,
            transaction_type=TransactionType.dispense,
            quantity=-qty,
            unit_price=inventory.selling_price,
            reference_id=sale.id,
            created_by=uuid.UUID(current_user.sub),
        ))

    await db.flush()
    result = await db.execute(
        select(PharmacySale).options(selectinload(PharmacySale.items)).where(PharmacySale.id == sale.id)
    )
    return _sale_to_dict(result.scalars().first())


# ── GET /pharmacy/sales ───────────────────────────────────────────────────────

@router.get("/sales")
async def list_sales(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
    q: Optional[str] = Query(None, description="search by invoice number"),
    limit: int = Query(20, le=100),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    query = select(PharmacySale).options(selectinload(PharmacySale.items)).where(
        PharmacySale.hospital_id == hospital_id
    )
    if q:
        query = query.where(PharmacySale.invoice_number.ilike(f"%{q}%"))
    query = query.order_by(PharmacySale.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return [_sale_to_dict(s) for s in result.scalars().all()]


@router.get("/sales/{sale_id}")
async def get_sale(
    sale_id: str,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    try:
        sid = uuid.UUID(sale_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid sale id.")
    result = await db.execute(
        select(PharmacySale).options(selectinload(PharmacySale.items)).where(
            PharmacySale.id == sid, PharmacySale.hospital_id == hospital_id
        )
    )
    sale = result.scalars().first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found.")
    return _sale_to_dict(sale)


@router.get("/sales/{sale_id}/pdf")
async def download_sale_pdf(
    sale_id: str,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    try:
        sid = uuid.UUID(sale_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid sale id.")
    result = await db.execute(
        select(PharmacySale).options(selectinload(PharmacySale.items)).where(
            PharmacySale.id == sid, PharmacySale.hospital_id == hospital_id
        )
    )
    sale = result.scalars().first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found.")

    hospital_result = await db.execute(select(Hospital).where(Hospital.id == hospital_id))
    hospital = hospital_result.scalars().first()

    # Resolve patient/walk-in customer name
    patient_name = ""
    patient_phone = ""
    patient_hospain_id = ""
    if sale.patient_id:
        from app.models.patient import Patient
        pat_result = await db.execute(select(Patient).where(Patient.id == sale.patient_id))
        pat = pat_result.scalars().first()
        if pat:
            patient_name = f"{pat.first_name} {pat.last_name}"
            patient_phone = pat.phone or ""
            patient_hospain_id = pat.hospyn_id or ""
    elif sale.walkin_customer_id:
        from app.models.pharmacy import WalkInCustomer
        wc_result = await db.execute(select(WalkInCustomer).where(WalkInCustomer.id == sale.walkin_customer_id))
        wc = wc_result.scalars().first()
        if wc:
            patient_name = wc.name
            patient_phone = wc.phone or ""

    try:
        from app.utils.pdf_engine import build_invoice_pdf, InvoiceData, InvoiceLineItem

        invoice_data = InvoiceData(
            invoice_number=sale.invoice_number,
            issued_at=sale.created_at or datetime.now(timezone.utc),
            pharmacy_name=hospital.name if hospital else "Pharmacy",
            pharmacy_address=(
                f"{hospital.address_line1 or ''}, {hospital.city or ''}".strip(", ")
                if hospital else ""
            ),
            pharmacy_phone=hospital.phone if hospital else "",
            invoice_type="Pharmacy Tax Invoice",
            payment_method=sale.payment_method.value.upper() if sale.payment_method else "",
            patient_name=patient_name,
            patient_phone=patient_phone,
            patient_hospain_id=patient_hospain_id,
            status="PAID",
            items=[
                InvoiceLineItem(
                    description=item.medicine_name,
                    quantity=item.quantity,
                    unit_price=float(item.unit_price),
                    tax_percent=5.0,
                )
                for item in sale.items
            ],
        )

        buf = build_invoice_pdf(invoice_data)
        return StreamingResponse(
            buf, media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=HOSPAIN-{sale.invoice_number}.pdf"},
        )

    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Install reportlab>=4.0.0 to enable PDF generation.",
        )
