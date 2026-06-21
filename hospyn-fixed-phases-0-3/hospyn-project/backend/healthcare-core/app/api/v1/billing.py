from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
import httpx
import os
import uuid

router = APIRouter(prefix="/billing", tags=["billing"])

RAZORPAY_KEY_ID = os.environ.get("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.environ.get("RAZORPAY_KEY_SECRET", "")


@router.post("/invoice")
async def generate_invoice(
    invoice_data: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Generate a billing invoice for a patient encounter."""
    from sqlalchemy import text
    invoice_id = str(uuid.uuid4())
    await db.execute(
        text("""INSERT INTO invoices (id, hospital_id, patient_id, total_amount, created_by, status)
                VALUES (:id, :hospital_id, :patient_id, :total_amount, :created_by, 'pending')"""),
        {**invoice_data, "id": invoice_id, "created_by": str(current_user.id)}
    )
    await db.commit()
    return {"status": "success", "invoice_id": invoice_id, "total": invoice_data.get("total_amount")}


@router.get("/invoices")
async def list_invoices(
    hospital_id: str,
    patient_id: str = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """List invoices for a hospital, optionally filtered by patient."""
    from sqlalchemy import text
    if patient_id:
        result = await db.execute(
            text("SELECT * FROM invoices WHERE hospital_id=:hid AND patient_id=:pid"),
            {"hid": hospital_id, "pid": patient_id}
        )
    else:
        result = await db.execute(
            text("SELECT * FROM invoices WHERE hospital_id=:hid"),
            {"hid": hospital_id}
        )
    return result.mappings().all()


@router.post("/payments/create-order")
async def create_razorpay_order(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create a Razorpay payment order for an invoice."""
    from sqlalchemy import text
    if not RAZORPAY_KEY_ID or not RAZORPAY_KEY_SECRET:
        raise HTTPException(status_code=503, detail="Payment gateway not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.")
    result = await db.execute(
        text("SELECT total_amount FROM invoices WHERE id=:id"),
        {"id": invoice_id}
    )
    invoice = result.mappings().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    amount_paise = int(float(invoice["total_amount"]) * 100)
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.razorpay.com/v1/orders",
            auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET),
            json={"amount": amount_paise, "currency": "INR", "receipt": str(invoice_id)}
        )
        response.raise_for_status()
    return response.json()


@router.post("/payments/webhook")
async def razorpay_webhook(
    payload: dict,
    db: AsyncSession = Depends(get_db)
):
    """Handle Razorpay payment confirmation webhooks."""
    if payload.get("event") == "payment.captured":
        payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
        receipt_id = payment.get("order_id")
        from sqlalchemy import text
        await db.execute(
            text("UPDATE invoices SET status='paid', payment_reference=:ref WHERE id=:id"),
            {"ref": payment.get("id"), "id": receipt_id}
        )
        await db.commit()
    return {"status": "ok"}
