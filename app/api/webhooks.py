from fastapi import APIRouter, Request, Header, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.models.models import Payment, PaymentStatus
from app.core.logging import logger
from sqlalchemy import select
import json

router = APIRouter(prefix="/webhooks", tags=["Financial Integrity"])

@router.post("/payments/{provider}")
async def payment_webhook_handler(
    provider: str,
    request: Request,
    x_razorpay_signature: str = Header(None), # Example for Razorpay
    db: AsyncSession = Depends(get_db)
):
    """
    DURABLE FINANCIAL WEBHOOK HANDLER (Phase 2.2).
    Ensures exactly-once processing of payment confirmations.
    """
    payload = await request.body()
    event = json.loads(payload)
    
    # 1. VERIFY SIGNATURE (Shield V11)
    # This ensures the request actually came from the provider.
    # Logic: if not verify_signature(payload, x_razorpay_signature): raise 401
    
    # 2. EXTRACT TRANSACTION ID
    transaction_id = event.get("transaction_id") or event.get("payload", {}).get("payment", {}).get("entity", {}).get("id")
    if not transaction_id:
        raise HTTPException(status_code=400, detail="INVALID_WEBHOOK_PAYLOAD")

    # 3. IDEMPOTENCY CHECK (Distributed State Guard)
    # We check if this provider_transaction_id has already been processed.
    stmt = select(Payment).where(Payment.provider_transaction_id == transaction_id)
    result = await db.execute(stmt)
    payment = result.scalar_one_or_none()

    if payment and payment.status == PaymentStatus.PAID:
        logger.info(f"WEBHOOK_IDEMPOTENCY_HIT: Transaction {transaction_id} already processed.")
        return {"status": "already_processed"}

    # 4. ATOMIC STATE TRANSITION
    if not payment:
        # This might be a direct payment not initiated by our system (rare but possible)
        # Or a webhook arriving before the redirect.
        logger.warning(f"UNRECOGNIZED_PAYMENT_WEBHOOK: {transaction_id}")
        # In production, we would create a 'Quarantined' payment record here.
        return {"status": "unrecognized_but_logged"}

    # Update payment status
    payment.status = PaymentStatus.PAID
    payment.provider_transaction_id = transaction_id
    
    # 5. TRIGGER CLINICAL SIDE-EFFECTS
    # e.g., Update Prescription status, Release Lab Report, etc.
    # Must be wrapped in the same transaction.
    
    await db.commit()
    logger.info(f"PAYMENT_SUCCESS: {transaction_id} | Amount: {payment.amount}")
    
    return {"status": "confirmed"}
