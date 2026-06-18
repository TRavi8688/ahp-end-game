"""
Partner Orders Routes
GET   /api/v1/partner/orders?status={filter}
PATCH /api/v1/partner/orders/{id}/status
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

router = APIRouter(prefix="", tags=["Partner Orders"])
security = HTTPBearer()

SECRET_KEY    = os.environ.get("PARTNER_JWT_SECRET", "CHANGE_ME_IN_PRODUCTION")
ALGORITHM     = "HS256"
VALID_STATUSES = {"pending", "confirmed", "processing", "shipped", "delivered", "cancelled"}


def get_current_partner(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        return jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Schemas ───────────────────────────────────────────────────────────────────
class OrderItem(BaseModel):
    item_id: str
    item_name: str
    quantity: int
    unit_price: float
    total: float


class Order(BaseModel):
    id: str
    order_number: str
    patient_name: str
    patient_phone: str
    status: str
    total_amount: float
    commission_amount: float
    items: List[OrderItem]
    created_at: str
    updated_at: str
    notes: Optional[str] = None


class StatusUpdateRequest(BaseModel):
    status: str
    notes: Optional[str] = None


# ── Helper ────────────────────────────────────────────────────────────────────
def _row_to_order(row) -> Order:
    """Convert an Order ORM row to the API schema."""
    items = []
    for li in getattr(row, "line_items", []) or []:
        items.append(OrderItem(
            item_id=str(getattr(li, "item_id", "")),
            item_name=getattr(li, "item_name", ""),
            quantity=getattr(li, "quantity", 0),
            unit_price=float(getattr(li, "unit_price", 0)),
            total=float(getattr(li, "total", 0)),
        ))

    return Order(
        id=str(row.id),
        order_number=getattr(row, "order_number", str(row.id)),
        patient_name=getattr(row, "patient_name", ""),
        patient_phone=getattr(row, "patient_phone", ""),
        status=row.status,
        total_amount=float(getattr(row, "total_amount", 0)),
        commission_amount=float(getattr(row, "commission_amount", 0)),
        items=items,
        created_at=row.created_at.isoformat() if row.created_at else "",
        updated_at=row.updated_at.isoformat() if getattr(row, "updated_at", None) else "",
        notes=getattr(row, "notes", None),
    )


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/orders", response_model=List[Order])
async def get_orders(
    status: Optional[str] = Query(None, description="Filter by status"),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_partner: dict = Depends(get_current_partner),
    db: AsyncSession = Depends(get_db),
):
    """Return orders for this partner from the database, filtered by status."""
    from app.models.order import Order as OrderModel  # type: ignore

    partner_id = current_partner.get("sub")
    stmt = select(OrderModel).where(OrderModel.partner_id == partner_id)

    if status and status != "all":
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status: {status}")
        stmt = stmt.where(OrderModel.status == status)

    if search:
        q = f"%{search}%"
        stmt = stmt.where(
            OrderModel.patient_name.ilike(q)
            | OrderModel.order_number.ilike(q)
        )

    stmt = (
        stmt.order_by(OrderModel.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [_row_to_order(r) for r in rows]


@router.patch("/orders/{order_id}/status")
async def update_order_status(
    order_id: str,
    body: StatusUpdateRequest,
    current_partner: dict = Depends(get_current_partner),
    db: AsyncSession = Depends(get_db),
):
    """Update the status of an order in the database."""
    from app.models.order import Order as OrderModel  # type: ignore

    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Must be one of: {sorted(VALID_STATUSES)}",
        )

    partner_id = current_partner.get("sub")
    result = await db.execute(
        select(OrderModel).where(
            OrderModel.id == order_id,
            OrderModel.partner_id == partner_id,
        )
    )
    order = result.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    order.status = body.status
    if hasattr(order, "updated_at"):
        order.updated_at = datetime.utcnow()
    if body.notes and hasattr(order, "notes"):
        order.notes = body.notes

    await db.commit()

    return {
        "success":    True,
        "id":         order_id,
        "status":     body.status,
        "updated_at": datetime.utcnow().isoformat(),
    }
