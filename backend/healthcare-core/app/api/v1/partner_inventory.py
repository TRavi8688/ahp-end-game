"""
Partner Inventory Routes
GET   /api/v1/partner/inventory
PATCH /api/v1/partner/inventory/{id}/stock
GET   /api/v1/partner/inventory/scan?qr={code}
"""

import os
from datetime import datetime
from typing import List, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="", tags=["Partner Inventory"])
security = HTTPBearer()

SECRET_KEY = os.environ.get("PARTNER_JWT_SECRET", "CHANGE_ME_IN_PRODUCTION")
ALGORITHM  = "HS256"


def get_current_partner(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        return jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Schemas ───────────────────────────────────────────────────────────────────
class InventoryItem(BaseModel):
    id: str
    item_name: str
    generic_name: str
    category: str
    sku_code: str
    batch_number: str
    expiry_date: str
    stock_quantity: int
    reorder_level: int
    unit_price: float
    mrp: float
    manufacturer: str
    qr_code: Optional[str] = None
    is_available: bool = True

    class Config:
        from_attributes = True


class StockUpdateRequest(BaseModel):
    stock_quantity: int
    reason: Optional[str] = "manual_adjustment"


class QRScanResult(BaseModel):
    found: bool
    item: Optional[InventoryItem] = None
    message: str


# ── Helper ────────────────────────────────────────────────────────────────────
def _row_to_item(row) -> InventoryItem:
    """Convert a PartnerInventory ORM row to the API schema."""
    return InventoryItem(
        id=str(row.id),
        item_name=row.item_name,
        generic_name=getattr(row, "generic_name", ""),
        category=getattr(row, "category", ""),
        sku_code=getattr(row, "sku_code", ""),
        batch_number=getattr(row, "batch_number", ""),
        expiry_date=str(getattr(row, "expiry_date", "")),
        stock_quantity=row.stock_quantity,
        reorder_level=getattr(row, "reorder_level", 0),
        unit_price=float(getattr(row, "unit_price", 0)),
        mrp=float(getattr(row, "mrp", 0)),
        manufacturer=getattr(row, "manufacturer", ""),
        qr_code=getattr(row, "qr_code", None),
        is_available=row.stock_quantity > 0,
    )


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/inventory", response_model=List[InventoryItem])
async def get_inventory(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None),
    current_partner: dict = Depends(get_current_partner),
    db: AsyncSession = Depends(get_db),
):
    """List all inventory items for this partner from the database."""
    from app.models.partner_inventory import PartnerInventory  # type: ignore

    partner_id = current_partner.get("sub")
    stmt = select(PartnerInventory).where(PartnerInventory.partner_id == partner_id)

    if category:
        stmt = stmt.where(PartnerInventory.category == category)
    if search:
        q = f"%{search}%"
        stmt = stmt.where(
            PartnerInventory.item_name.ilike(q)
            | PartnerInventory.generic_name.ilike(q)
        )
    if low_stock is True:
        stmt = stmt.where(
            PartnerInventory.stock_quantity <= PartnerInventory.reorder_level
        )

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [_row_to_item(r) for r in rows]


@router.patch("/inventory/{item_id}/stock")
async def update_stock(
    item_id: str,
    body: StockUpdateRequest,
    current_partner: dict = Depends(get_current_partner),
    db: AsyncSession = Depends(get_db),
):
    """Update stock quantity for an inventory item in the database."""
    from app.models.partner_inventory import PartnerInventory  # type: ignore

    partner_id = current_partner.get("sub")
    result = await db.execute(
        select(PartnerInventory).where(
            PartnerInventory.id == item_id,
            PartnerInventory.partner_id == partner_id,
        )
    )
    item = result.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    item.stock_quantity = body.stock_quantity
    await db.commit()

    return {
        "success":        True,
        "id":             item_id,
        "stock_quantity": body.stock_quantity,
        "reason":         body.reason,
        "updated_at":     datetime.utcnow().isoformat(),
    }


@router.get("/inventory/scan", response_model=QRScanResult)
async def scan_qr(
    qr: str = Query(..., description="QR code string from scanner"),
    current_partner: dict = Depends(get_current_partner),
    db: AsyncSession = Depends(get_db),
):
    """Look up an inventory item by QR code from the database."""
    from app.models.partner_inventory import PartnerInventory  # type: ignore

    partner_id = current_partner.get("sub")
    result = await db.execute(
        select(PartnerInventory).where(
            PartnerInventory.qr_code == qr,
            PartnerInventory.partner_id == partner_id,
        )
    )
    item = result.scalars().first()

    if not item:
        return QRScanResult(found=False, item=None, message=f"No item found for QR: {qr}")

    return QRScanResult(
        found=True,
        item=_row_to_item(item),
        message="Item found successfully",
    )
