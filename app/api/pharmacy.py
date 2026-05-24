from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List
import uuid
from datetime import datetime

from app.core.database import get_db
from app.api import deps
from app.models.models import PharmacyInventory, InventoryTransaction, InventoryTransactionType, Invoice, BillItem, PaymentStatus, Patient, PartnerPharmacyRequest, DigitalPrescription, User
from app.schemas.pharmacy import Pharmacy as PharmacySchema, PharmacyCreate, InventoryTransaction as TransactionSchema, DispenseRequest, PharmacyAIScanRequest, PharmacyAIScanResponse
import asyncio
import base64
from sqlalchemy.orm import selectinload
from app.core.config import settings
import json

from app.core.security import require_module

router = APIRouter(dependencies=[Depends(require_module("pharmacy"))])


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

@router.get("/network-orders")
async def get_network_orders(
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    UNIVERSAL PRESCRIPTION NETWORK:
    Fetches external prescriptions shared by patients to this pharmacy via QR scan.
    """
    stmt = select(PartnerPharmacyRequest).where(
        PartnerPharmacyRequest.partner_pharmacy_id == hospital_id,
        PartnerPharmacyRequest.status == "pending"
    ).options(
        selectinload(PartnerPharmacyRequest.prescription),
        selectinload(PartnerPharmacyRequest.patient).selectinload(Patient.user)
    ).order_by(PartnerPharmacyRequest.created_at.desc())
    
    result = await db.execute(stmt)
    requests = result.scalars().all()
    
    orders = []
    for req in requests:
        first_name = req.patient.user.first_name if req.patient.user else "Patient"
        last_name = req.patient.user.last_name if req.patient.user else ""
        orders.append({
            "id": str(req.id),
            "prescription_id": str(req.prescription_id),
            "patient_name": f"{first_name} {last_name}".strip(),
            "patient_phone": req.patient.phone_number or "N/A",
            "diagnosis": req.prescription.diagnosis,
            "medications": req.prescription.medications,
            "shared_at": req.created_at.isoformat() if req.created_at else None
        })
    return orders

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

@router.post("/bulk-upload", response_model=dict)
async def bulk_upload_stock(
    items_in: List[PharmacyCreate],
    db: AsyncSession = Depends(get_db),
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    BULK PROCUREMENT:
    Ingests thousands of SKUs from distributor CSVs instantly.
    """
    added_count = 0
    for obj_in in items_in:
        item = PharmacyInventory(
            **obj_in.model_dump(),
            hospital_id=hospital_id
        )
        db.add(item)
        await db.flush() # Flush to get item ID

        txn = InventoryTransaction(
            hospital_id=hospital_id,
            inventory_item_id=item.id,
            transaction_type=InventoryTransactionType.PURCHASE,
            quantity=obj_in.stock_quantity,
            notes="Bulk CSV Upload"
        )
        db.add(txn)
        added_count += 1

    await db.commit()
    return {"status": "success", "items_added": added_count}

@router.post("/ai-scan", response_model=PharmacyAIScanResponse)
async def ai_scan_medication(
    req: PharmacyAIScanRequest,
    hospital_id: uuid.UUID = Depends(deps.get_hospital_id)
):
    """
    VISION AI PROCUREMENT:
    Sends the captured image to Gemini 1.5 to extract structured medical data from the wrapper.
    """
    if not settings.GEMINI_API_KEY:
        # Fallback if no key is configured
        await asyncio.sleep(1.0)
        now = datetime.now()
        next_year = now.replace(year=now.year + 2)
        return PharmacyAIScanResponse(
            item_name="Dolo 650 (MOCK - No API Key)",
            generic_name="Paracetamol IP 650mg",
            batch_number=f"BNO-{now.strftime('%H%M%S')}",
            expiry_date=next_year.strftime("%Y-%m-%d"),
            unit_price=30.50,
            confidence=0.98
        )
        
    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.5-flash')
        
        # Remove data:image/...;base64, prefix if present
        b64_data = req.image_base64
        if "base64," in b64_data:
            b64_data = b64_data.split("base64,")[1]
            
        image_bytes = base64.b64decode(b64_data)
        image_parts = [{"mime_type": "image/jpeg", "data": image_bytes}]
        
        prompt = '''
        Analyze this image of a medicine wrapper/bottle. Extract the following details and return ONLY a valid JSON object. Do not include markdown formatting or backticks.
        JSON format:
        {
          "item_name": "string (brand name)",
          "generic_name": "string (salt/composition)",
          "batch_number": "string",
          "expiry_date": "YYYY-MM-DD",
          "unit_price": float (MRP)
        }
        If a field is missing, guess logically or leave empty string/0.0.
        '''
        
        response = await asyncio.to_thread(model.generate_content, [prompt, image_parts[0]])
        text = response.text.replace('```json', '').replace('```', '').strip()
        data = json.loads(text)
        
        now = datetime.now()
        next_year = now.replace(year=now.year + 2)
        
        return PharmacyAIScanResponse(
            item_name=data.get("item_name", "Unknown Medicine"),
            generic_name=data.get("generic_name", ""),
            batch_number=data.get("batch_number", f"BNO-{now.strftime('%H%M%S')}"),
            expiry_date=data.get("expiry_date", next_year.strftime("%Y-%m-%d")),
            unit_price=float(data.get("unit_price", 0.0)),
            confidence=0.92
        )
    except Exception as e:
        print(f"Gemini Extraction Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to extract data from image. Please try again or enter manually.")

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
