# backend/healthcare-core/app/api/v1/partner_queue.py
# Pharmacy prescription queue management
# Handles: incoming Rx from patient app, manual entry, accept, bill, UPI trigger, cancel

import uuid
import secrets
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_partner
from app.models.partner import Partner
from app.models.queue import PrescriptionQueue, QueueItem
from app.models.partner_inventory import PartnerInventory
from shared.notifications import send_push_notification
from shared.upi import generate_upi_link

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ManualItemIn(BaseModel):
    medicine_name: str
    quantity:      float
    price:         float


class ManualQueueIn(BaseModel):
    name:  str
    phone: str
    items: List[ManualItemIn]


class SwapIn(BaseModel):
    original_name: str


class QueueItemOut(BaseModel):
    medicine_name: str
    generic_name:  Optional[str]
    quantity:      float
    dosage:        Optional[str]
    in_stock:      bool
    stock_qty:     int
    substitute:    Optional[dict]

    class Config:
        from_attributes = True


class QueueOut(BaseModel):
    id:           str
    queue_number: int
    patient_name: str
    patient_phone: str
    patient_id:   Optional[str]
    source:       str
    status:       str
    items:        List[QueueItemOut]
    total_amount: float
    accepted_by:  Optional[str]
    created_at:   datetime
    notes:        str

    class Config:
        from_attributes = True


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _check_stock(db: AsyncSession, partner_id: str, items: List[QueueItem]) -> List[dict]:
    """Check each item against inventory and find substitutes if needed."""
    enriched = []
    for item in items:
        # Find by name (case-insensitive) or generic name
        result = await db.execute(
            select(PartnerInventory).where(
                PartnerInventory.partner_id == partner_id,
                func.lower(PartnerInventory.item_name) == item.medicine_name.lower()
            )
        )
        inv = result.scalar_one_or_none()

        in_stock  = inv is not None and inv.stock_quantity >= item.quantity
        stock_qty = inv.stock_quantity if inv else 0
        substitute = None

        if not in_stock:
            # Try to find substitute by generic name
            if inv and inv.generic_name:
                sub_result = await db.execute(
                    select(PartnerInventory).where(
                        PartnerInventory.partner_id == partner_id,
                        func.lower(PartnerInventory.generic_name) == inv.generic_name.lower(),
                        PartnerInventory.item_name != inv.item_name,
                        PartnerInventory.stock_quantity >= item.quantity
                    ).limit(1)
                )
                sub = sub_result.scalar_one_or_none()
                if sub:
                    substitute = {
                        "id":    str(sub.id),
                        "name":  sub.item_name,
                        "price": sub.unit_price
                    }

        enriched.append({
            "medicine_name": item.medicine_name,
            "generic_name":  inv.generic_name if inv else None,
            "quantity":      item.quantity,
            "dosage":        item.dosage,
            "in_stock":      in_stock,
            "stock_qty":     stock_qty,
            "substitute":    substitute,
        })
    return enriched


async def _next_queue_number(db: AsyncSession, partner_id: str) -> int:
    """Get next queue number for today."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(func.max(PrescriptionQueue.queue_number)).where(
            PrescriptionQueue.partner_id == partner_id,
            PrescriptionQueue.created_at >= today_start
        )
    )
    last = result.scalar() or 0
    return last + 1


def _to_out(rx: PrescriptionQueue, enriched_items: List[dict]) -> dict:
    return {
        "id":            str(rx.id),
        "queue_number":  rx.queue_number,
        "patient_name":  rx.patient_name,
        "patient_phone": rx.patient_phone,
        "patient_id":    str(rx.patient_id) if rx.patient_id else None,
        "source":        rx.source,
        "status":        rx.status,
        "items":         enriched_items,
        "total_amount":  rx.total_amount,
        "accepted_by":   rx.accepted_by,
        "created_at":    rx.created_at,
        "notes":         rx.notes or "",
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/queue", response_model=List[dict])
async def get_queue(
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    """Get today's full queue for this partner."""
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    result = await db.execute(
        select(PrescriptionQueue).where(
            PrescriptionQueue.partner_id == partner.id,
            PrescriptionQueue.created_at >= today_start,
        ).order_by(PrescriptionQueue.queue_number)
    )
    rxs = result.scalars().all()

    output = []
    for rx in rxs:
        enriched = await _check_stock(db, str(partner.id), rx.items or [])
        output.append(_to_out(rx, enriched))
    return output


@router.post("/queue/manual", response_model=dict)
async def add_manual_patient(
    body:    ManualQueueIn,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    """Staff adds a walk-in patient manually (no app)."""
    queue_num = await _next_queue_number(db, str(partner.id))
    total     = sum(i.quantity * i.price for i in body.items)

    items_data = [
        QueueItem(
            medicine_name=i.medicine_name,
            quantity=i.quantity,
            dosage=None,
            unit_price=i.price
        )
        for i in body.items
    ]

    rx = PrescriptionQueue(
        id=uuid.uuid4(),
        partner_id=partner.id,
        patient_name=body.name,
        patient_phone=body.phone,
        patient_id=None,
        source="manual",
        status="waiting",
        queue_number=queue_num,
        items=items_data,
        total_amount=total,
        notes="",
    )
    db.add(rx)
    await db.commit()
    await db.refresh(rx)

    enriched = await _check_stock(db, str(partner.id), rx.items)
    return _to_out(rx, enriched)


@router.post("/queue/{rx_id}/accept", response_model=dict)
async def accept_prescription(
    rx_id:   str,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    """Staff accepts a waiting prescription. One staff member owns it."""
    result = await db.execute(
        select(PrescriptionQueue).where(
            PrescriptionQueue.id == uuid.UUID(rx_id),
            PrescriptionQueue.partner_id == partner.id,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if rx.status != "waiting":
        raise HTTPException(status_code=400, detail=f"Cannot accept — current status: {rx.status}")

    rx.status      = "accepted"
    rx.accepted_by = partner.email
    rx.updated_at  = datetime.utcnow()
    await db.commit()
    await db.refresh(rx)

    enriched = await _check_stock(db, str(partner.id), rx.items)
    return _to_out(rx, enriched)


@router.post("/queue/{rx_id}/swap", response_model=dict)
async def swap_medicine(
    rx_id:   str,
    body:    SwapIn,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    """Staff swaps an out-of-stock medicine with its substitute."""
    result = await db.execute(
        select(PrescriptionQueue).where(
            PrescriptionQueue.id == uuid.UUID(rx_id),
            PrescriptionQueue.partner_id == partner.id,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    # Find substitute in inventory
    orig_result = await db.execute(
        select(PartnerInventory).where(
            PartnerInventory.partner_id == partner.id,
            func.lower(PartnerInventory.item_name) == body.original_name.lower(),
        )
    )
    orig_inv = orig_result.scalar_one_or_none()
    if not orig_inv:
        raise HTTPException(status_code=404, detail="Original item not found in inventory")

    sub_result = await db.execute(
        select(PartnerInventory).where(
            PartnerInventory.partner_id == partner.id,
            func.lower(PartnerInventory.generic_name) == (orig_inv.generic_name or "").lower(),
            PartnerInventory.item_name != orig_inv.item_name,
            PartnerInventory.stock_quantity > 0,
        ).limit(1)
    )
    sub = sub_result.scalar_one_or_none()
    if not sub:
        raise HTTPException(status_code=404, detail="No substitute available")

    # Update item name in queue items
    for item in (rx.items or []):
        if item.medicine_name.lower() == body.original_name.lower():
            item.medicine_name = sub.item_name
            item.unit_price    = sub.unit_price
            break

    # Recalculate total
    rx.total_amount = sum((i.quantity * i.unit_price) for i in rx.items)
    rx.updated_at   = datetime.utcnow()
    await db.commit()
    await db.refresh(rx)

    enriched = await _check_stock(db, str(partner.id), rx.items)
    return _to_out(rx, enriched)


@router.post("/queue/{rx_id}/bill", response_model=dict)
async def generate_bill(
    rx_id:   str,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    """Confirm items and generate bill. Moves to 'billing' status."""
    result = await db.execute(
        select(PrescriptionQueue).where(
            PrescriptionQueue.id == uuid.UUID(rx_id),
            PrescriptionQueue.partner_id == partner.id,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if rx.status != "accepted":
        raise HTTPException(status_code=400, detail="Must be in 'accepted' state to bill")

    # Final total calculation from current items + inventory prices
    final_total = 0.0
    for item in (rx.items or []):
        inv_result = await db.execute(
            select(PartnerInventory).where(
                PartnerInventory.partner_id == partner.id,
                func.lower(PartnerInventory.item_name) == item.medicine_name.lower(),
            )
        )
        inv = inv_result.scalar_one_or_none()
        price = inv.unit_price if inv else item.unit_price
        item.unit_price = price
        final_total += item.quantity * price

    rx.total_amount = round(final_total, 2)
    rx.status       = "billing"
    rx.updated_at   = datetime.utcnow()
    await db.commit()
    await db.refresh(rx)

    enriched = await _check_stock(db, str(partner.id), rx.items)
    return _to_out(rx, enriched)


@router.post("/queue/{rx_id}/payment/initiate", response_model=dict)
async def initiate_payment(
    rx_id:   str,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    """Generate UPI deep link for patient payment. No money handled by Hospyn."""
    result = await db.execute(
        select(PrescriptionQueue).where(
            PrescriptionQueue.id == uuid.UUID(rx_id),
            PrescriptionQueue.partner_id == partner.id,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")
    if rx.status != "billing":
        raise HTTPException(status_code=400, detail="Must be in 'billing' state to initiate payment")

    # Transaction reference for webhook matching
    txn_ref = f"HOSPYN-{str(rx.id)[:8].upper()}-{secrets.token_hex(4).upper()}"
    rx.upi_txn_ref = txn_ref
    rx.status      = "payment_pending"
    rx.updated_at  = datetime.utcnow()
    await db.commit()

    # UPI deep link — navigates to GPay/PhonePe/etc. on mobile
    # Format: upi://pay?pa=VPA&pn=Name&am=AMOUNT&cu=INR&tn=NOTE&tr=REF
    upi_link = generate_upi_link(
        vpa=partner.upi_id or f"{partner.partner_code}@upi",
        payee_name=partner.name,
        amount=rx.total_amount,
        note=f"Medicine purchase #{rx.queue_number}",
        txn_ref=txn_ref,
    )

    return {"upi_link": upi_link, "txn_ref": txn_ref, "amount": rx.total_amount}


@router.get("/queue/{rx_id}/payment/status", response_model=dict)
async def check_payment_status(
    rx_id:   str,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    """Poll payment status. Called every 5s by frontend until confirmed or timeout."""
    result = await db.execute(
        select(PrescriptionQueue).where(
            PrescriptionQueue.id == uuid.UUID(rx_id),
            PrescriptionQueue.partner_id == partner.id,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Not found")

    return {"paid": rx.status == "done", "status": rx.status}


@router.post("/queue/{rx_id}/cancel", response_model=dict)
async def cancel_prescription(
    rx_id:   str,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    result = await db.execute(
        select(PrescriptionQueue).where(
            PrescriptionQueue.id == uuid.UUID(rx_id),
            PrescriptionQueue.partner_id == partner.id,
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Not found")

    rx.status     = "cancelled"
    rx.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(rx)
    enriched = await _check_stock(db, str(partner.id), rx.items)
    return _to_out(rx, enriched)


# ── UPI Webhook (called by UPI gateway or manual confirm) ────────────────────

class UPIWebhookIn(BaseModel):
    txn_ref:    str
    status:     str   # "SUCCESS" | "FAILED"
    upi_txn_id: str


@router.post("/queue/webhook/upi", include_in_schema=False)
async def upi_webhook(
    body:             UPIWebhookIn,
    background_tasks: BackgroundTasks,
    db:               AsyncSession = Depends(get_db),
):
    """
    Called by UPI gateway after payment completes.
    Marks order done, deducts inventory, sends receipt to patient.
    """
    result = await db.execute(
        select(PrescriptionQueue).where(
            PrescriptionQueue.upi_txn_ref == body.txn_ref
        )
    )
    rx = result.scalar_one_or_none()
    if not rx:
        return {"ok": False, "detail": "txn_ref not found"}

    if body.status == "SUCCESS":
        rx.status      = "done"
        rx.paid_at     = datetime.utcnow()
        rx.upi_txn_id  = body.upi_txn_id
        rx.updated_at  = datetime.utcnow()
        await db.commit()

        # Deduct stock
        for item in (rx.items or []):
            inv_result = await db.execute(
                select(PartnerInventory).where(
                    PartnerInventory.partner_id == rx.partner_id,
                    func.lower(PartnerInventory.item_name) == item.medicine_name.lower(),
                )
            )
            inv = inv_result.scalar_one_or_none()
            if inv:
                inv.stock_quantity = max(0, inv.stock_quantity - int(item.quantity))
        await db.commit()

        # Send receipt to patient app in background
        if rx.patient_id:
            background_tasks.add_task(
                send_push_notification,
                user_id=str(rx.patient_id),
                title="Payment Confirmed ✓",
                body=f"₹{rx.total_amount:.0f} paid. Your receipt is ready.",
                data={"type": "rx_receipt", "queue_id": str(rx.id)},
            )
    else:
        rx.status     = "billing"  # revert so staff can retry
        rx.updated_at = datetime.utcnow()
        await db.commit()

    return {"ok": True}
