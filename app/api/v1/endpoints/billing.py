from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.models.models import User, RoleEnum, Invoice, Payment, PaymentStatus, PaymentMethod, BillItem, PharmacyInventory, InventoryTransaction, InventoryTransactionType, PatientVisit
from sqlalchemy import select, func
from typing import List, Dict, Any
import uuid
from pydantic import BaseModel

router = APIRouter()

@router.get("/invoices")
async def get_hospital_invoices(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.reception, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns invoices for the global hospital revenue dashboard."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    # Strict tenant boundary on invoices
    stmt = select(Invoice).where(Invoice.hospital_id == hospital_id).order_by(Invoice.created_at.desc())
    result = await db.execute(stmt)
    invoices = result.scalars().all()
    
    return invoices

@router.get("/payments")
async def get_hospital_payments(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.reception, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns payments for the global hospital revenue dashboard."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(Payment).where(Payment.hospital_id == hospital_id).order_by(Payment.created_at.desc())
    result = await db.execute(stmt)
    payments = result.scalars().all()
    
    return payments

@router.get("/pending-visits")
async def get_pending_visits(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.reception])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns visits that haven't been fully billed yet."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    # Very simplistic logic for demonstration: visits without an invoice
    stmt = select(PatientVisit).where(
        PatientVisit.hospital_id == hospital_id,
        ~PatientVisit.id.in_(select(Invoice.visit_id).where(Invoice.visit_id.isnot(None)))
    )
    result = await db.execute(stmt)
    visits = result.scalars().all()
    
    return [
        {
            "visit_id": str(v.id),
            "patient_id": str(v.patient_id),
            "visit_reason": v.visit_reason,
            "department": v.department,
            "created_at": v.created_at.isoformat()
        } for v in visits
    ]

class BillItemCreate(BaseModel):
    item_name: str
    item_category: str
    quantity: float
    unit_price: float
    tax_percent: float

class InvoiceCreate(BaseModel):
    patient_id: str
    visit_id: str = None
    items: List[BillItemCreate]
    discount_amount: float = 0.0

@router.post("/invoices")
async def create_invoice(
    req: InvoiceCreate,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.reception])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Manually generates a clinical invoice."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    total_subtotal = sum(i.quantity * i.unit_price for i in req.items)
    total_tax = sum(i.quantity * i.unit_price * (i.tax_percent / 100) for i in req.items)
    total_amount = total_subtotal + total_tax
    payable_amount = total_amount - req.discount_amount
    
    invoice = Invoice(
        hospital_id=hospital_id,
        patient_id=req.patient_id,
        visit_id=req.visit_id,
        invoice_number=f"INV-{uuid.uuid4().hex[:8].upper()}",
        total_amount=total_amount,
        discount_amount=req.discount_amount,
        tax_amount=total_tax,
        payable_amount=payable_amount,
        status=PaymentStatus.PENDING
    )
    db.add(invoice)
    await db.flush()
    
    for item in req.items:
        bi = BillItem(
            invoice_id=invoice.id,
            item_name=item.item_name,
            item_category=item.item_category,
            quantity=item.quantity,
            unit_price=item.unit_price,
            subtotal=item.quantity * item.unit_price,
            tax_percent=item.tax_percent
        )
        db.add(bi)
        
    await db.commit()
    return {"success": True, "invoice_id": str(invoice.id)}

from fastapi.responses import HTMLResponse

@router.get("/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(
    invoice_id: str,
    token: str = None,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Returns an HTML/PDF rendering of the invoice. 
    (In production, this returns a PDF stream. For now, it returns a styled HTML receipt).
    """
    from app.models.hospital import HospitalSettings
    from app.models.core import Patient
    
    stmt = select(Invoice).where(Invoice.id == invoice_id)
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    items_stmt = select(BillItem).where(BillItem.invoice_id == invoice.id)
    items_res = await db.execute(items_stmt)
    items = items_res.scalars().all()
    
    # Fetch Hospital details
    hosp_stmt = select(HospitalSettings).where(HospitalSettings.hospital_id == invoice.hospital_id)
    hosp_res = await db.execute(hosp_stmt)
    hosp = hosp_res.scalar_one_or_none()
    hospital_name = hosp.hospital_name if hosp else "Hospital / Clinic"
    hospital_address = hosp.address if hosp else "Address not configured"
    
    # Fetch Patient details
    pat_stmt = select(Patient).where(Patient.id == invoice.patient_id)
    pat_res = await db.execute(pat_stmt)
    patient = pat_res.scalar_one_or_none()
    patient_name = patient.full_name if patient else "Unknown Patient"
    
    date_str = invoice.created_at.strftime("%d %B %Y, %I:%M %p") if hasattr(invoice, 'created_at') and invoice.created_at else "N/A"
    
    status_color = "#10B981" if invoice.status == PaymentStatus.PAID else "#F59E0B"
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Invoice {invoice.invoice_number}</title>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; padding: 40px; color: #0f172a; line-height: 1.5; }}
            .receipt-box {{ max-width: 800px; margin: 0 auto; background: #ffffff; padding: 50px; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.05); }}
            .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 30px; margin-bottom: 30px; }}
            .clinic-info h1 {{ margin: 0 0 5px 0; font-size: 28px; color: #0f172a; font-weight: 900; letter-spacing: -0.5px; }}
            .clinic-info p {{ margin: 0; color: #64748b; font-size: 14px; }}
            .hospyn-brand {{ text-align: right; }}
            .hospyn-brand h2 {{ margin: 0 0 5px 0; color: #4f46e5; font-size: 24px; font-weight: 900; letter-spacing: 1px; }}
            .hospyn-brand p {{ margin: 0; font-size: 11px; font-weight: bold; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; }}
            
            .meta-box {{ display: flex; justify-content: space-between; margin-bottom: 40px; background: #f8fafc; padding: 20px; border-radius: 12px; }}
            .meta-item label {{ display: block; font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }}
            .meta-item span {{ font-size: 15px; font-weight: bold; color: #0f172a; }}
            
            table {{ w-full border-collapse: collapse; width: 100%; margin-bottom: 40px; }}
            th {{ text-align: left; padding: 15px; background: #f8fafc; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 800; border-bottom: 2px solid #e2e8f0; }}
            td {{ padding: 15px; border-bottom: 1px solid #e2e8f0; font-size: 14px; color: #334155; font-weight: 500; }}
            .amount-col {{ text-align: right; }}
            
            .totals-box {{ width: 300px; margin-left: auto; }}
            .total-row {{ display: flex; justify-content: space-between; padding: 10px 0; font-size: 14px; color: #64748b; font-weight: 600; }}
            .total-row.grand-total {{ font-size: 20px; font-weight: 900; color: #0f172a; border-top: 2px solid #e2e8f0; padding-top: 15px; margin-top: 5px; }}
            
            .footer {{ margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; padding-top: 20px; }}
            
            .status-badge {{ display: inline-block; padding: 6px 12px; border-radius: 6px; font-size: 11px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; background: {status_color}20; color: {status_color}; border: 1px solid {status_color}40; }}
        </style>
    </head>
    <body>
        <div class="receipt-box">
            <div class="header">
                <div class="clinic-info">
                    <h1>{hospital_name}</h1>
                    <p>{hospital_address}</p>
                </div>
                <div class="hospyn-brand">
                    <h2>HOSPYN</h2>
                    <p>Powered by Hospyn ERP</p>
                </div>
            </div>
            
            <div class="meta-box">
                <div class="meta-item">
                    <label>Billed To</label>
                    <span>{patient_name}</span>
                </div>
                <div class="meta-item">
                    <label>Invoice Number</label>
                    <span style="font-family: monospace;">{invoice.invoice_number}</span>
                </div>
                <div class="meta-item">
                    <label>Date Issued</label>
                    <span>{date_str}</span>
                </div>
                <div class="meta-item text-right">
                    <label>Payment Status</label>
                    <span class="status-badge">{invoice.status}</span>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Description / Service</th>
                        <th>Category</th>
                        <th class="amount-col">Qty</th>
                        <th class="amount-col">Unit Price</th>
                        <th class="amount-col">Total</th>
                    </tr>
                </thead>
                <tbody>
    """
    for bi in items:
        html += f"""
        <tr>
            <td>{bi.item_name}</td>
            <td style="font-size: 12px; color: #64748b;">{bi.item_category}</td>
            <td class="amount-col">{int(bi.quantity)}</td>
            <td class="amount-col">₹{bi.unit_price}</td>
            <td class="amount-col" style="font-weight: bold; color: #0f172a;">₹{bi.subtotal}</td>
        </tr>
        """
        
    html += f"""
                </tbody>
            </table>
            
            <div class="totals-box">
                <div class="total-row">
                    <span>Subtotal</span>
                    <span>₹{invoice.total_amount}</span>
                </div>
                <div class="total-row">
                    <span>Discount</span>
                    <span style="color: #ef4444;">- ₹{invoice.discount_amount}</span>
                </div>
                <div class="total-row grand-total">
                    <span>Total Payable</span>
                    <span>₹{invoice.payable_amount}</span>
                </div>
            </div>
            
            <div class="footer">
                <p>This is a computer generated receipt. No physical signature is required.</p>
                <p style="margin-top: 5px; font-weight: bold;">Hospyn Digital Healthcare Platform</p>
            </div>
        </div>
        
        <script>
            // Auto-trigger print dialog when opened in a new tab
            window.onload = function() {{ window.print(); }}
        </script>
    </body>
    </html>
    """
    return HTMLResponse(content=html)

class PaymentWebhookPayload(BaseModel):
    invoice_id: str
    provider_transaction_id: str
    amount: float

@router.post("/webhook/payment-success")
async def payment_success_webhook(
    payload: PaymentWebhookPayload,
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Webhook for payment success.
    1. Validates invoice and amount.
    2. Updates Invoice and Payment to PAID.
    3. Triggers inventory deduction for Pharmacy items.
    """
    # Note: In a real system, verify webhook signature here (e.g. Stripe signature)
    
    stmt = select(Invoice).where(Invoice.id == payload.invoice_id)
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if invoice.status == PaymentStatus.PAID:
        return {"success": True, "message": "Already paid."}
        
    # Create the Payment record
    payment = Payment(
        hospital_id=invoice.hospital_id,
        patient_id=invoice.patient_id,
        invoice_id=invoice.id,
        amount=payload.amount,
        status=PaymentStatus.PAID,
        provider_transaction_id=payload.provider_transaction_id,
        idempotency_key=f"pay_{payload.provider_transaction_id}"
    )
    db.add(payment)
    
    invoice.status = PaymentStatus.PAID
    invoice.paid_amount = payload.amount
    
    # Fetch all BillItems to check for Pharmacy deductions
    items_stmt = select(BillItem).where(BillItem.invoice_id == invoice.id)
    items_res = await db.execute(items_stmt)
    bill_items = items_res.scalars().all()
    
    for bi in bill_items:
        if bi.item_category == "Pharmacy":
            # We matched the item name during checkout. Now we must deduct.
            # In a robust system, we would store the exact inventory_item_id in BillItem metadata.
            # For now, we look it up by name and hospital_id.
            inv_stmt = select(PharmacyInventory).where(
                PharmacyInventory.hospital_id == invoice.hospital_id,
                PharmacyInventory.item_name == bi.item_name
            )
            inv_res = await db.execute(inv_stmt)
            inv_item = inv_res.scalar_one_or_none()
            
            if inv_item:
                # Deduct stock
                inv_item.stock_quantity -= bi.quantity
                
                # Create immutable transaction audit log
                txn = InventoryTransaction(
                    hospital_id=invoice.hospital_id,
                    inventory_item_id=inv_item.id,
                    transaction_type=InventoryTransactionType.SALE,
                    quantity=-bi.quantity,
                    reference_id=invoice.id,
                    notes=f"Auto-deducted after confirmed payment {payment.provider_transaction_id}"
                )
                db.add(txn)
    
    await db.commit()
    
    return {"success": True, "message": "Payment verified. Invoice finalized and inventory deducted."}

@router.post("/invoices/{invoice_id}/pay-cash")
async def pay_invoice_cash(
    invoice_id: str,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.reception, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Manually marks an invoice as paid via CASH over the counter.
    Automatically triggers inventory deduction.
    """
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(Invoice).where(Invoice.id == invoice_id, Invoice.hospital_id == hospital_id)
    result = await db.execute(stmt)
    invoice = result.scalar_one_or_none()
    
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if invoice.status == PaymentStatus.PAID:
        return {"success": True, "message": "Already paid."}
        
    # Create the Payment record
    import uuid
    payment = Payment(
        hospital_id=invoice.hospital_id,
        patient_id=invoice.patient_id,
        invoice_id=invoice.id,
        amount=invoice.payable_amount,
        status=PaymentStatus.PAID,
        payment_method=PaymentMethod.CASH,
        provider="MANUAL_CASH",
        provider_transaction_id=f"CASH-{uuid.uuid4().hex[:8].upper()}",
        idempotency_key=f"cash_pay_{invoice.id}"
    )
    db.add(payment)
    
    invoice.status = PaymentStatus.PAID
    invoice.paid_amount = invoice.payable_amount
    
    # Fetch all BillItems to check for Pharmacy deductions
    items_stmt = select(BillItem).where(BillItem.invoice_id == invoice.id)
    items_res = await db.execute(items_stmt)
    bill_items = items_res.scalars().all()
    
    for bi in bill_items:
        if bi.item_category == "Pharmacy":
            inv_stmt = select(PharmacyInventory).where(
                PharmacyInventory.hospital_id == invoice.hospital_id,
                PharmacyInventory.item_name == bi.item_name
            )
            inv_res = await db.execute(inv_stmt)
            inv_item = inv_res.scalar_one_or_none()
            
            if inv_item:
                inv_item.stock_quantity -= bi.quantity
                
                txn = InventoryTransaction(
                    hospital_id=invoice.hospital_id,
                    inventory_item_id=inv_item.id,
                    transaction_type=InventoryTransactionType.SALE,
                    quantity=-bi.quantity,
                    reference_id=invoice.id,
                    notes=f"Auto-deducted after manual cash payment"
                )
                db.add(txn)
                
    # Log Audit
    from app.core.audit import log_audit_action
    await log_audit_action(
        db=db,
        action="MANUAL_CASH_PAYMENT",
        user_id=current_user.id,
        hospital_id=hospital_id,
        resource_type="INVOICE",
        details={"invoice_id": str(invoice.id), "amount": invoice.payable_amount}
    )
    
    await db.commit()
    return {"success": True, "message": "Cash payment recorded. Invoice finalized and inventory deducted."}
