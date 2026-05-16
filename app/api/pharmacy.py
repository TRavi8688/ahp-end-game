from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import uuid
from datetime import datetime

from app.core.database import get_db
from app.api import deps
from app.models.models import PharmacyInventory, InventoryTransaction, InventoryTransactionType, Invoice, BillItem, PaymentStatus, Patient
from app.schemas.pharmacy import Pharmacy as PharmacySchema, PharmacyCreate, InventoryTransaction as TransactionSchema, DispenseRequest

router = APIRouter()

@router.get("/stats")
async def get_pharmacy_stats(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    INVENTORY INTELLIGENCE:
    Calculates operational metrics for the pharmacy dashboard.
    """
    now = datetime.now()
    thirty_days_later = now.replace(day=now.day + 30) if now.day <= 1 else now # Simplified for now
    
    # 1. Total SKU
    sku_stmt = select(func.count(PharmacyInventory.id)).where(PharmacyInventory.hospital_id == hospital_id)
    sku_res = await db.execute(sku_stmt)
    total_items = sku_res.scalar() or 0
    
    # 2. Low Stock
    low_stmt = select(func.count(PharmacyInventory.id)).where(
        PharmacyInventory.hospital_id == hospital_id,
        PharmacyInventory.stock_quantity <= PharmacyInventory.reorder_level
    )
    low_res = await db.execute(low_stmt)
    low_stock = low_res.scalar() or 0
    
    # 3. Near Expiry
    # (Simplified date logic for SQLite)
    expiry_stmt = select(func.count(PharmacyInventory.id)).where(
        PharmacyInventory.hospital_id == hospital_id,
        PharmacyInventory.expiry_date <= thirty_days_later
    )
    expiry_res = await db.execute(expiry_stmt)
    near_expiry = expiry_res.scalar() or 0
    
    # 4. Today's Revenue (from Inventory Transactions)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    rev_stmt = select(func.sum(BillItem.subtotal)).join(Invoice).where(
        Invoice.hospital_id == hospital_id,
        Invoice.created_at >= today_start,
        BillItem.item_category == "Pharmacy"
    )
    rev_res = await db.execute(rev_stmt)
    today_rev = rev_res.scalar() or 0.0
    
    return {
        "totalItems": total_items,
        "lowStock": low_stock,
        "nearExpiry": near_expiry,
        "todaySales": f"₹{today_rev:,.0f}"
    }

@router.get("/inventory", response_model=List[PharmacySchema])
async def get_pharmacy_inventory(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    DISPENSARY MONITOR:
    Lists all medications in stock for the hospital.
    """
    stmt = select(PharmacyInventory).where(PharmacyInventory.hospital_id == hospital_id)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/inventory", response_model=PharmacySchema)
async def add_stock(
    obj_in: PharmacyCreate,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    PROCUREMENT ENTRY:
    Adds new medication batches to the pharmacy stock.
    """
    item = PharmacyInventory(
        **obj_in.model_dump(),
        hospital_id=hospital_id
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    
    # Create an initial 'PURCHASE' transaction
    txn = InventoryTransaction(
        hospital_id=hospital_id,
        inventory_item_id=item.id,
        transaction_type=InventoryTransactionType.PURCHASE,
        quantity=obj_in.stock_quantity,
        notes="Initial stock entry"
    )
    db.add(txn)
    await db.commit()
    return item

@router.post("/dispense")
async def dispense_medication(
    req: DispenseRequest,
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    ATOMIC DISPENSING:
    1. Deducts stock from inventory.
    2. Logs the transaction.
    3. Adds the item to the patient's active visit invoice.
    """
    # 1. Fetch or Create Invoice
    invoice = None
    if req.visit_id:
        # Try to find existing invoice for this visit
        inv_stmt = select(Invoice).where(Invoice.visit_id == req.visit_id, Invoice.hospital_id == hospital_id)
        inv_res = await db.execute(inv_stmt)
        invoice = inv_res.scalar_one_or_none()
        
    if not invoice:
        # Generate new invoice if none exists
        count_stmt = select(func.count(Invoice.id)).where(Invoice.hospital_id == hospital_id)
        count_res = await db.execute(count_stmt)
        count = count_res.scalar() or 0
        invoice_number = f"PHARM-{datetime.now().strftime('%Y%m%d')}-{count + 1:04d}"
        
        invoice = Invoice(
            invoice_number=invoice_number,
            patient_id=req.patient_id,
            hospital_id=hospital_id,
            visit_id=req.visit_id,
            status=PaymentStatus.PENDING
        )
        db.add(invoice)
        await db.flush()

    # 2. Process Items
    for item_req in req.items:
        # Check stock
        stock_item_stmt = select(PharmacyInventory).where(PharmacyInventory.id == item_req.inventory_item_id)
        stock_res = await db.execute(stock_item_stmt)
        stock_item = stock_res.scalar_one_or_none()
        
        if not stock_item or stock_item.stock_quantity < abs(item_req.quantity):
            raise HTTPException(status_code=400, detail=f"Insufficient stock for {stock_item.item_name if stock_item else 'item'}")

        # Update Stock
        stock_item.stock_quantity -= abs(item_req.quantity)
        
        # Log Transaction
        txn = InventoryTransaction(
            hospital_id=hospital_id,
            inventory_item_id=stock_item.id,
            transaction_type=InventoryTransactionType.SALE,
            quantity=-abs(item_req.quantity),
            reference_id=invoice.id,
            notes=req.notes
        )
        db.add(txn)
        
        # Add to Invoice
        subtotal = abs(item_req.quantity) * stock_item.unit_price
        tax = subtotal * (stock_item.tax_percent / 100)
        
        bill_item = BillItem(
            invoice_id=invoice.id,
            item_name=stock_item.item_name,
            item_category="Pharmacy",
            quantity=abs(item_req.quantity),
            unit_price=stock_item.unit_price,
            subtotal=subtotal,
            tax_percent=stock_item.tax_percent
        )
        db.add(bill_item)
        
        # Update Invoice Totals
        invoice.total_amount += subtotal
        invoice.tax_amount += tax
        invoice.payable_amount += (subtotal + tax)

    await db.commit()
    return {"status": "success", "invoice_id": invoice.id}

@router.get("/transactions", response_model=List[TransactionSchema])
async def get_pharmacy_transactions(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """AUDIT TRAIL: Returns the history of all pharmacy movements."""
    stmt = select(InventoryTransaction).where(InventoryTransaction.hospital_id == hospital_id).order_by(InventoryTransaction.created_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()
