import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import Invoice, BillItem, PaymentStatus, PatientVisit, Hospital, Payment, PaymentMethod
from app.schemas.billing import InvoiceCreate, BillItemCreate, PaymentCreate

logger = logging.getLogger(__name__)

class BillingService:
    @staticmethod
    async def create_invoice(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        patient_id: uuid.UUID,
        visit_id: Optional[uuid.UUID],
        items_data: List[BillItemCreate],
        notes: Optional[str] = None
    ) -> Invoice:
        """
        GENERATE CLINICAL INVOICE:
        Calculates taxes, totals, and generates a unique invoice number.
        """
        # 1. Generate Invoice Number (e.g. INV-HOSP-2024-0001)
        # In a real system, this would be a more robust sequence
        timestamp = datetime.now().strftime("%Y%m%d%H%M")
        invoice_number = f"INV-{str(hospital_id)[:4].upper()}-{timestamp}-{uuid.uuid4().hex[:4].upper()}"

        # 2. Calculate Totals
        total_amount = 0.0
        tax_amount = 0.0
        
        bill_items = []
        for item in items_data:
            line_total = item.quantity * item.unit_price
            line_tax = line_total * (item.tax_percent / 100.0)
            
            total_amount += line_total
            tax_amount += line_tax
            
            bill_items.append(BillItem(
                description=item.description,
                category=item.category,
                quantity=item.quantity,
                unit_price=item.unit_price,
                tax_percent=item.tax_percent,
                total_price=line_total + line_tax,
                reference_id=item.reference_id
            ))

        payable_amount = total_amount + tax_amount

        # 3. Create Invoice (Uncommitted)
        invoice = Invoice(
            hospital_id=hospital_id,
            patient_id=patient_id,
            visit_id=visit_id,
            invoice_number=invoice_number,
            status=PaymentStatus.ISSUED,
            total_amount=total_amount,
            tax_amount=tax_amount,
            payable_amount=payable_amount,
            paid_amount=0.0,
            notes=notes,
            items=bill_items
        )

        db.add(invoice)
        await db.flush() # Get invoice.id for reference

        # 4. Atomic Pharmacy Deduction
        from app.services.pharmacy_service import PharmacyService
        for item in items_data:
            if item.category.lower() == "pharmacy" and item.reference_id:
                try:
                    await PharmacyService.deduct_stock(
                        db=db,
                        hospital_id=hospital_id,
                        stock_id=item.reference_id,
                        quantity=int(item.quantity),
                        reference_id=invoice.id
                    )
                except ValueError as e:
                    logger.error(f"STOCK_DEDUCTION_FAILED: {e}")
                    raise # Rollback transaction if stock is missing

        await db.commit()
        await db.refresh(invoice)
        
        logger.info(f"INVOICE_GENERATED_WITH_STOCK_DEDUCTION: {invoice_number}")
        return invoice

    @staticmethod
    async def record_payment(
        db: AsyncSession,
        invoice_id: uuid.UUID,
        payment_data: PaymentCreate
    ) -> Payment:
        """
        RECORD FINANCIAL TRANSACTION:
        Updates invoice status based on payment amount.
        """
        stmt = select(Invoice).where(Invoice.id == invoice_id)
        result = await db.execute(stmt)
        invoice = result.scalar_one_or_none()

        if not invoice:
            raise ValueError("Invoice not found")

        # 1. Create Transaction
        transaction = Payment(
            hospital_id=invoice.hospital_id,
            invoice_id=invoice.id,
            amount=payment_data.amount,
            method=payment_data.method,
            transaction_ref=payment_data.transaction_ref,
            status="success"
        )

        # 2. Update Invoice Paid Amount
        invoice.paid_amount += payment_data.amount
        
        if invoice.paid_amount >= invoice.payable_amount:
            invoice.status = PaymentStatus.PAID
        elif invoice.paid_amount > 0:
            invoice.status = PaymentStatus.PARTIALLY_PAID

        db.add(transaction)
        await db.commit()
        await db.refresh(transaction)
        
        return transaction

    @staticmethod
    async def get_patient_invoices(
        db: AsyncSession,
        patient_id: uuid.UUID
    ) -> List[Invoice]:
        stmt = select(Invoice).where(Invoice.patient_id == patient_id).order_by(Invoice.created_at.desc())
        result = await db.execute(stmt)
        return result.scalars().all()
