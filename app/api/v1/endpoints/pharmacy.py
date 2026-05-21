
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.api import deps
from app.models.models import User, RoleEnum, PharmacyStock
from sqlalchemy import select
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
    stmt = select(PharmacyStock).where(PharmacyStock.hospital_id == hospital_id)
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
    sku_count_stmt = select(PharmacyStock).where(PharmacyStock.hospital_id == hospital_id)
    result = await db.execute(sku_count_stmt)
    all_items = result.scalars().all()
    
    total_sku = len(all_items)
    critical_stock = len([i for i in all_items if i.quantity <= i.min_stock_level])
    
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
    category: str
    batch_number: str
    expiry_date: datetime
    unit_price: float
    stock_quantity: int
    min_stock_level: int = 10
    reorder_level: int = 20

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
    
    new_item = PharmacyStock(
        hospital_id=hospital_id,
        item_name=item_in.item_name,
        generic_name=item_in.generic_name,
        category=item_in.category,
        batch_number=item_in.batch_number,
        expiry_date=item_in.expiry_date,
        unit_price=item_in.unit_price,
        quantity=item_in.stock_quantity,
        min_stock_level=item_in.min_stock_level,
        reorder_level=item_in.reorder_level
    )
    db.add(new_item)
    
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
    stock_quantity: int
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
    
    stmt = select(PharmacyStock).where(
        PharmacyStock.id == item_id, 
        PharmacyStock.hospital_id == hospital_id # Strict tenancy
    )
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found in this hospital's inventory")
        
    old_qty = item.quantity
    item.quantity = item_in.stock_quantity
    if item_in.unit_price is not None:
        item.unit_price = item_in.unit_price
        
    # Log the action
    from app.core.audit import log_audit_action
    await log_audit_action(
        db=db,
        action="PHARMACY_STOCK_UPDATED",
        user_id=current_user.id,
        hospital_id=hospital_id,
        resource_type="PHARMACY",
        details={"item": item.item_name, "old_qty": old_qty, "new_qty": item.quantity}
    )
    
    await db.commit()
    return {"success": True, "id": str(item.id)}

