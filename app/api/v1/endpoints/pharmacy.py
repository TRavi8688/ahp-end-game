
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.models.models import User, RoleEnum, PharmacyInventory, InventoryTransaction, InventoryTransactionType, DigitalPrescription, Invoice, BillItem, PaymentStatus
from sqlalchemy import select, func
from typing import List, Dict, Any
import uuid
from app.core.security import require_module

router = APIRouter(dependencies=[Depends(require_module("pharmacy"))])

@router.get("/inventory")
async def get_inventory(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns the list of all medications in stock for the current hospital."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    # Implicitly filtered by TenantScopedMixin if get_db handles it, 
    # but we'll be explicit for safety in this enterprise layer.
    stmt = select(PharmacyInventory).where(PharmacyInventory.hospital_id == hospital_id)
    result = await db.execute(stmt)
    items = result.scalars().all()
    
    return items

@router.get("/stats")
async def get_pharmacy_stats(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Calculates real-time inventory metrics."""
    if not current_user.staff_profile:
         raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
    
    hospital_id = current_user.staff_profile.hospital_id
    
    # 1. Total SKU
    sku_count_stmt = select(PharmacyInventory).where(PharmacyInventory.hospital_id == hospital_id)
    result = await db.execute(sku_count_stmt)
    all_items = result.scalars().all()
    
    total_sku = len(all_items)
    critical_stock = len([i for i in all_items if i.stock_quantity <= i.reorder_level])
    
    # Calculate Near Expiry (expires in next 30 days)
    from datetime import datetime, timedelta
    thirty_days_from_now = datetime.utcnow() + timedelta(days=30)
    near_expiry_count = len([i for i in all_items if i.expiry_date and i.expiry_date <= thirty_days_from_now])
    
    # Calculate Today Sales (sum of Pharmacy bill items paid today)
    # This would require a join with BillItem and Payment, but for this specific endpoint
    # we can leave it as 0 if we don't want to add a complex join, or we can write the query.
    # To avoid complex cross-module dependencies here, we'll return 0 or do a basic calculation.
    # The requirement is NO MOCK DATA.
    from sqlalchemy import func
    from app.models.models import BillItem, Invoice, Payment, PaymentStatus
    
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    sales_stmt = (
        select(func.sum(BillItem.subtotal))
        .join(Invoice, BillItem.invoice_id == Invoice.id)
        .join(Payment, Payment.invoice_id == Invoice.id)
        .where(
            Payment.hospital_id == hospital_id,
            Payment.status == PaymentStatus.PAID,
            Payment.created_at >= today_start,
            BillItem.item_category == "Pharmacy"
        )
    )
    sales_result = await db.execute(sales_stmt)
    today_sales = sales_result.scalar() or 0.0
    
    return {
        "totalItems": total_sku,
        "lowStock": critical_stock,
        "nearExpiry": near_expiry_count,
        "todaySales": float(today_sales)
    }

from pydantic import BaseModel, Field
from datetime import datetime

class InventoryItemCreate(BaseModel):
    item_name: str
    generic_name: str
    batch_number: str
    expiry_date: datetime
    unit_price: float
    stock_quantity: float
    reorder_level: float = 10.0
    hsn_code: str = ""
    tax_percent: float = 12.0

@router.post("/inventory")
async def add_inventory_item(
    item_in: InventoryItemCreate,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Adds a new medication to the hospital's pharmacy stock."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    new_item = PharmacyInventory(
        hospital_id=hospital_id,
        item_name=item_in.item_name,
        generic_name=item_in.generic_name,
        batch_number=item_in.batch_number,
        expiry_date=item_in.expiry_date,
        unit_price=item_in.unit_price,
        stock_quantity=item_in.stock_quantity,
        reorder_level=item_in.reorder_level,
        hsn_code=item_in.hsn_code,
        tax_percent=item_in.tax_percent
    )
    db.add(new_item)
    await db.flush() # Flush to get the ID
    
    # Add Transaction Record
    txn = InventoryTransaction(
        hospital_id=hospital_id,
        inventory_item_id=new_item.id,
        transaction_type=InventoryTransactionType.PURCHASE,
        quantity=item_in.stock_quantity,
        notes="Initial stock intake"
    )
    db.add(txn)
    
    # Log the action
    from app.core.audit import log_audit_action
    await log_audit_action(
        db=db,
        action="PHARMACY_STOCK_ADDED",
        user_id=current_user.id,
        hospital_id=hospital_id,
        resource_type="PHARMACY",
        details={"item": item_in.item_name, "quantity": item_in.stock_quantity}
    )
    
    await db.commit()
    return {"success": True, "id": str(new_item.id)}

class InventoryItemUpdate(BaseModel):
    stock_quantity: float
    unit_price: float = None

@router.put("/inventory/{item_id}")
async def update_inventory_item(
    item_id: str,
    item_in: InventoryItemUpdate,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Updates an existing medication's stock quantity and/or price."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(PharmacyInventory).where(
        PharmacyInventory.id == item_id, 
        PharmacyInventory.hospital_id == hospital_id # Strict tenancy
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in this hospital's inventory")
        
    old_qty = item.stock_quantity
    qty_diff = item_in.stock_quantity - old_qty
    
    item.stock_quantity = item_in.stock_quantity
    if item_in.unit_price is not None:
        item.unit_price = item_in.unit_price
        
    if qty_diff != 0:
        txn = InventoryTransaction(
            hospital_id=hospital_id,
            inventory_item_id=item.id,
            transaction_type=InventoryTransactionType.ADJUSTMENT,
            quantity=qty_diff,
            notes="Manual adjustment via update"
        )
        db.add(txn)
        
    # Log the action
    from app.core.audit import log_audit_action
    await log_audit_action(
        db=db,
        action="PHARMACY_STOCK_UPDATED",
        user_id=current_user.id,
        hospital_id=hospital_id,
        resource_type="PHARMACY",
        details={"item": item.item_name, "old_qty": old_qty, "new_qty": item.stock_quantity}
    )
    
    await db.commit()
    return {"success": True, "id": str(item.id)}

@router.get("/verify-prescription/{prescription_id}")
async def verify_prescription(
    prescription_id: str,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Validates a digital prescription against the current hospital's pharmacy stock.
    Enforces tenant isolation by checking if the prescription belongs to the hospital.
    """
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
    
    hospital_id = current_user.staff_profile.hospital_id
    
    stmt = select(DigitalPrescription).where(
        DigitalPrescription.id == prescription_id,
        DigitalPrescription.hospital_id == hospital_id # STRICT TENANT BOUNDARY
    )
    result = await db.execute(stmt)
    prescription = result.scalar_one_or_none()
    
    if not prescription:
        raise HTTPException(status_code=404, detail="Prescription not found or belongs to another hospital")
        
    verification_results = []
    
    # Verify stock availability for each prescribed medication
    for med in prescription.medications:
        # Match by name (case-insensitive) within this hospital's inventory
        inv_stmt = select(PharmacyInventory).where(
            PharmacyInventory.hospital_id == hospital_id,
            func.lower(PharmacyInventory.item_name).like(f"%{med.get('name', '').lower()}%")
        )
        inv_res = await db.execute(inv_stmt)
        inv_item = inv_res.scalar_one_or_none()
        
        if inv_item:
            verification_results.append({
                "name": med.get("name", ""),
                "dosage": med.get("dosage", ""),
                "frequency": med.get("frequency", ""),
                "duration": med.get("duration", ""),
                "available": inv_item.stock_quantity,
                "price": inv_item.unit_price,
                "inventory_item_id": str(inv_item.id),
                "status": "AVAILABLE" if inv_item.stock_quantity > 0 else "OUT_OF_STOCK"
            })
        else:
             verification_results.append({
                "name": med.get("name", ""),
                "dosage": med.get("dosage", ""),
                "frequency": med.get("frequency", ""),
                "duration": med.get("duration", ""),
                "available": 0,
                "price": 0.0,
                "inventory_item_id": None,
                "status": "UNAVAILABLE"
            })
            
    return {
        "prescription_id": str(prescription.id),
        "patient_id": str(prescription.patient_id),
        "diagnosis": prescription.diagnosis,
        "items": verification_results
    }

class CheckoutItem(BaseModel):
    inventory_item_id: str
    quantity: float

class CheckoutRequest(BaseModel):
    patient_id: str
    prescription_id: str = None
    items: List[CheckoutItem]

@router.post("/checkout")
async def process_checkout(
    req: CheckoutRequest,
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """
    Step 3: Billing & Payment Initiation.
    Creates a PENDING invoice for the patient. 
    IMPORTANT: Inventory deduction occurs ONLY after payment success webhook.
    """
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
    
    hospital_id = current_user.staff_profile.hospital_id
    total_amount = 0.0
    bill_items_to_create = []
    
    # 1. Verify stock and calculate total (STRICT TENANT BOUNDARY)
    for req_item in req.items:
        stmt = select(PharmacyInventory).where(
            PharmacyInventory.id == req_item.inventory_item_id,
            PharmacyInventory.hospital_id == hospital_id
        )
        result = await db.execute(stmt)
        inv_item = result.scalar_one_or_none()
        
        if not inv_item:
            raise HTTPException(status_code=404, detail=f"Item {req_item.inventory_item_id} not found.")
            
        if inv_item.stock_quantity < req_item.quantity:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient stock for {inv_item.item_name}. Requested: {req_item.quantity}, Available: {inv_item.stock_quantity}"
            )
            
        subtotal = inv_item.unit_price * req_item.quantity
        total_amount += subtotal
        
        bill_items_to_create.append(BillItem(
            item_name=inv_item.item_name,
            item_category="Pharmacy",
            quantity=req_item.quantity,
            unit_price=inv_item.unit_price,
            subtotal=subtotal,
            tax_percent=inv_item.tax_percent
        ))

    # 2. Create the PENDING Invoice
    import uuid
    from datetime import datetime
    
    invoice = Invoice(
        hospital_id=hospital_id,
        patient_id=req.patient_id,
        invoice_number=f"PH-{uuid.uuid4().hex[:8].upper()}",
        total_amount=total_amount,
        payable_amount=total_amount,
        status=PaymentStatus.PENDING,
        due_date=datetime.utcnow()
    )
    
    db.add(invoice)
    await db.flush() # get invoice.id
    
    # 3. Attach BillItems
    for bi in bill_items_to_create:
        bi.invoice_id = invoice.id
        db.add(bi)
        
    # 4. Push Notification Hook (Simulated via Outbox or simple log)
    # The Patient App will detect this PENDING invoice via WebSocket or Polling
    
    # Log Audit
    from app.core.audit import log_audit_action
    await log_audit_action(
        db=db,
        action="PHARMACY_CHECKOUT_INITIATED",
        user_id=current_user.id,
        hospital_id=hospital_id,
        resource_type="INVOICE",
        details={"invoice_id": str(invoice.id), "total": total_amount}
    )
    
    await db.commit()
    
    return {
        "success": True, 
        "invoice_id": str(invoice.id), 
        "total_amount": total_amount,
        "status": "AWAITING_PAYMENT",
        "message": "Invoice beamed to Patient App. Awaiting secure payment confirmation before dispensing."
    }

@router.get("/history")
async def get_dispensation_history(
    current_user: User = Depends(deps.RoleChecker([RoleEnum.hospital_admin, RoleEnum.admin, RoleEnum.pharmacy])),
    db: AsyncSession = Depends(deps.get_db)
):
    """Returns all historically fulfilled prescriptions."""
    if not current_user.staff_profile:
        raise HTTPException(status_code=403, detail="User not linked to a hospital profile")
        
    hospital_id = current_user.staff_profile.hospital_id
    
    from app.models.models import PrescriptionStatusEnum, Patient
    from app.models.clinical import Prescription
    
    stmt = (
        select(Prescription, Patient)
        .join(Patient, Prescription.patient_id == Patient.id)
        .where(
            Prescription.hospital_id == hospital_id,
            Prescription.status == PrescriptionStatusEnum.fulfilled
        )
        .order_by(Prescription.created_at.desc())
    )
    
    result = await db.execute(stmt)
    rows = result.all()
    
    history = []
    for prescription, patient in rows:
        history.append({
            "id": str(prescription.id),
            "date": prescription.created_at.isoformat(),
            "patient_name": f"{patient.user.first_name} {patient.user.last_name}" if patient.user else "Unknown Patient",
            "hospyn_id": patient.hospyn_id,
            "diagnosis": prescription.diagnosis,
            "medications": prescription.medications
        })
        
    return history
