"""
backend/healthcare-core/app/api/v1/pharmacy_ops.py

Backs the More tab: Reports (Screens 24-25), Supplier Management (29),
Purchase Entry (30), and Finance (31). Customer Management (26-27) reuses
existing /patients endpoints + the new /pharmacy/sales history, so it isn't
duplicated here. Staff Management (28) reuses the existing /staff endpoints
(see app/api/v1/staff.py) -- also not duplicated.

GET  /pharmacy/suppliers
POST /pharmacy/suppliers
GET  /pharmacy/purchase-orders
POST /pharmacy/purchase-orders        - stock-in: also bumps inventory + logs an Expense
GET  /pharmacy/expenses
POST /pharmacy/expenses
GET  /pharmacy/reports/sales          - revenue/bills/profit over a period
GET  /pharmacy/reports/inventory      - stock value, low/expiring/out-of-stock counts
GET  /pharmacy/reports/customers      - repeat vs new, top customers by spend
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.pharmacy_ops import Supplier, PurchaseOrder, PurchaseOrderItem, Expense, ExpenseCategory
from app.models.pharmacy import (
    PharmacyInventory, PharmacyTransaction, TransactionType, PharmacySale,
)
from app.api.v1.pharmacy import _resolve_pharmacy_hospital_id, PHARMACY_ROLES, _to_decimal

router = APIRouter()


# -- Suppliers -----------------------------------------------------------------

class SupplierIn(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    gstin: Optional[str] = None


def _supplier_to_dict(s: Supplier) -> dict:
    return {
        "id": str(s.id), "name": s.name, "contact_person": s.contact_person,
        "phone": s.phone, "email": s.email, "address": s.address, "gstin": s.gstin,
    }


@router.get("/suppliers")
async def list_suppliers(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    result = await db.execute(select(Supplier).where(Supplier.hospital_id == hospital_id).order_by(Supplier.name))
    return [_supplier_to_dict(s) for s in result.scalars().all()]


@router.post("/suppliers", status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: SupplierIn,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    supplier = Supplier(id=uuid.uuid4(), hospital_id=hospital_id, **payload.model_dump())
    db.add(supplier)
    await db.flush()
    return _supplier_to_dict(supplier)


# -- Purchase Entry ------------------------------------------------------------

class PurchaseLine(BaseModel):
    inventory_item_id: Optional[str] = None  # existing item being restocked
    medicine_name: str
    quantity: int = Field(gt=0)
    unit_cost: float


class PurchaseOrderIn(BaseModel):
    supplier_id: str
    invoice_number: Optional[str] = None
    items: List[PurchaseLine]


@router.get("/purchase-orders")
async def list_purchase_orders(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    result = await db.execute(
        select(PurchaseOrder).options(selectinload(PurchaseOrder.items), selectinload(PurchaseOrder.supplier))
        .where(PurchaseOrder.hospital_id == hospital_id)
        .order_by(PurchaseOrder.created_at.desc())
        .limit(50)
    )
    orders = result.scalars().all()
    return [
        {
            "id": str(po.id),
            "supplier_name": po.supplier.name if po.supplier else "Unknown",
            "invoice_number": po.invoice_number,
            "total_amount": float(po.total_amount),
            "created_at": po.created_at.isoformat() if po.created_at else None,
            "items": [{"medicine_name": i.medicine_name, "quantity": i.quantity, "unit_cost": float(i.unit_cost)} for i in po.items],
        }
        for po in orders
    ]


@router.post("/purchase-orders", status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: PurchaseOrderIn,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    """Stock-in: bumps matching inventory quantities and logs a 'purchase' expense automatically."""
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    try:
        supplier_uuid = uuid.UUID(payload.supplier_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid supplier_id.")

    supplier_result = await db.execute(
        select(Supplier).where(Supplier.id == supplier_uuid, Supplier.hospital_id == hospital_id)
    )
    if not supplier_result.scalars().first():
        raise HTTPException(status_code=404, detail="Supplier not found.")

    total = Decimal("0.00")
    po = PurchaseOrder(
        id=uuid.uuid4(), hospital_id=hospital_id, supplier_id=supplier_uuid,
        invoice_number=payload.invoice_number, created_by=uuid.UUID(current_user.sub),
    )
    db.add(po)
    await db.flush()

    for line in payload.items:
        cost = _to_decimal(line.unit_cost)
        total += cost * line.quantity
        db.add(PurchaseOrderItem(
            id=uuid.uuid4(), purchase_order_id=po.id,
            inventory_item_id=uuid.UUID(line.inventory_item_id) if line.inventory_item_id else None,
            medicine_name=line.medicine_name, quantity=line.quantity, unit_cost=cost,
        ))

        if line.inventory_item_id:
            inv_result = await db.execute(
                select(PharmacyInventory).where(
                    and_(PharmacyInventory.id == uuid.UUID(line.inventory_item_id),
                         PharmacyInventory.hospital_id == hospital_id)
                )
            )
            inventory = inv_result.scalars().first()
            if inventory:
                inventory.quantity_available += line.quantity
                db.add(PharmacyTransaction(
                    id=uuid.uuid4(), hospital_id=hospital_id, inventory_item_id=inventory.id,
                    transaction_type=TransactionType.purchase, quantity=line.quantity,
                    unit_price=cost, reference_id=po.id, created_by=uuid.UUID(current_user.sub),
                ))

    po.total_amount = total
    db.add(Expense(
        id=uuid.uuid4(), hospital_id=hospital_id, category=ExpenseCategory.purchase,
        description=f"Stock purchase -- PO {str(po.id)[:8]}", amount=total,
        created_by=uuid.UUID(current_user.sub),
    ))
    await db.flush()

    result = await db.execute(
        select(PurchaseOrder).options(selectinload(PurchaseOrder.items)).where(PurchaseOrder.id == po.id)
    )
    final_po = result.scalars().first()
    return {
        "id": str(final_po.id), "total_amount": float(final_po.total_amount),
        "items": [{"medicine_name": i.medicine_name, "quantity": i.quantity, "unit_cost": float(i.unit_cost)} for i in final_po.items],
    }


# -- Expenses ------------------------------------------------------------------

class ExpenseIn(BaseModel):
    category: str = "other"
    description: Optional[str] = None
    amount: float = Field(gt=0)


@router.get("/expenses")
async def list_expenses(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    result = await db.execute(
        select(Expense).where(Expense.hospital_id == hospital_id).order_by(Expense.created_at.desc()).limit(100)
    )
    return [
        {"id": str(e.id), "category": e.category.value, "description": e.description,
         "amount": float(e.amount), "created_at": e.created_at.isoformat() if e.created_at else None}
        for e in result.scalars().all()
    ]


@router.post("/expenses", status_code=status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseIn,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    try:
        category = ExpenseCategory(payload.category)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"category must be one of {[c.value for c in ExpenseCategory]}")
    expense = Expense(
        id=uuid.uuid4(), hospital_id=hospital_id, category=category,
        description=payload.description, amount=_to_decimal(payload.amount),
        created_by=uuid.UUID(current_user.sub),
    )
    db.add(expense)
    await db.flush()
    return {"id": str(expense.id), "category": expense.category.value, "amount": float(expense.amount)}


# -- Reports -------------------------------------------------------------------

@router.get("/reports/sales")
async def sales_report(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
    period: str = Query("week", description="today | week | month"),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    days = {"today": 1, "week": 7, "month": 30}.get(period)
    if not days:
        raise HTTPException(status_code=400, detail="period must be today, week, or month")
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)

    sales_result = await db.execute(
        select(PharmacySale).where(and_(PharmacySale.hospital_id == hospital_id, PharmacySale.created_at >= cutoff))
    )
    sales = sales_result.scalars().all()
    revenue = sum((s.total for s in sales), Decimal("0.00"))

    expense_result = await db.execute(
        select(func.coalesce(func.sum(Expense.amount), 0)).where(
            and_(Expense.hospital_id == hospital_id, Expense.created_at >= cutoff)
        )
    )
    expenses = expense_result.scalar_one() or 0

    return {
        "period": period,
        "bills": len(sales),
        "revenue": float(revenue),
        "expenses": float(expenses),
        "profit": float(revenue) - float(expenses),
    }


@router.get("/reports/inventory")
async def inventory_report(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    result = await db.execute(select(PharmacyInventory).where(PharmacyInventory.hospital_id == hospital_id))
    items = result.scalars().all()

    stock_value = sum((i.selling_price or Decimal("0")) * i.quantity_available for i in items)
    low_stock = sum(1 for i in items if 0 < i.quantity_available <= i.reorder_level)
    out_of_stock = sum(1 for i in items if i.quantity_available <= 0)
    expiry_cutoff = datetime.now(timezone.utc).date() + timedelta(days=30)
    expiring = sum(1 for i in items if i.expiry_date and i.expiry_date <= expiry_cutoff)

    return {
        "total_items": len(items),
        "stock_value": float(stock_value),
        "low_stock": low_stock,
        "out_of_stock": out_of_stock,
        "expiring": expiring,
    }


@router.get("/reports/customers")
async def customer_report(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    sales_result = await db.execute(
        select(PharmacySale).where(PharmacySale.hospital_id == hospital_id)
    )
    sales = sales_result.scalars().all()

    spend_by_customer: dict = {}
    for s in sales:
        key = str(s.patient_id or s.walkin_customer_id or "unknown")
        spend_by_customer.setdefault(key, {"id": key, "total_spent": 0.0, "visits": 0})
        spend_by_customer[key]["total_spent"] += float(s.total)
        spend_by_customer[key]["visits"] += 1

    top_customers = sorted(spend_by_customer.values(), key=lambda c: c["total_spent"], reverse=True)[:10]
    return {
        "total_customers": len(spend_by_customer),
        "repeat_customers": sum(1 for c in spend_by_customer.values() if c["visits"] > 1),
        "top_customers": top_customers,
    }


# -- Preferences (best-effort: stored in memory / future: in DB) ---------------
# Simple in-memory store per hospital_id (resets on service restart).
# This is intentionally lightweight — preferences are non-critical UI state.
# A future migration can persist this to a JSONB column on the Hospital model.

_PREFS_STORE: dict = {}


@router.get("/preferences")
async def get_preferences(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    return _PREFS_STORE.get(str(hospital_id), {
        "auto_print": True,
        "low_stock_alerts": True,
        "order_alerts": True,
    })


@router.patch("/preferences")
async def update_preferences(
    patch: dict,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    key = str(hospital_id)
    existing = _PREFS_STORE.get(key, {
        "auto_print": True,
        "low_stock_alerts": True,
        "order_alerts": True,
    })
    # Only allow known preference keys to prevent junk data
    ALLOWED_KEYS = {"auto_print", "low_stock_alerts", "order_alerts"}
    for k, v in patch.items():
        if k in ALLOWED_KEYS and isinstance(v, bool):
            existing[k] = v
    _PREFS_STORE[key] = existing
    return existing
