"""
Partner Dashboard Routes
GET /api/v1/partner/dashboard-stats
"""

import os
from datetime import datetime, timedelta
from typing import List, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="", tags=["Partner Dashboard"])
security = HTTPBearer()

SECRET_KEY = os.environ.get("PARTNER_JWT_SECRET", "CHANGE_ME_IN_PRODUCTION")
ALGORITHM  = "HS256"


def get_current_partner(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Schemas ───────────────────────────────────────────────────────────────────
class RevenuePoint(BaseModel):
    month: str
    revenue: float
    commission: float


class DashboardStats(BaseModel):
    total_orders: int
    total_revenue: float
    pending_referrals: int
    commission_earned: float
    commission_pending: float
    active_patients: int
    conversion_rate: float
    revenue_trend: List[RevenuePoint]
    recent_activity: List[dict]


# ── Route ─────────────────────────────────────────────────────────────────────
@router.get("/dashboard-stats", response_model=DashboardStats)
async def get_dashboard_stats(
    current_partner: dict = Depends(get_current_partner),
    db: AsyncSession = Depends(get_db),
):
    """Returns KPI stats for the partner dashboard from the database."""
    from app.models.partner import Partner

    partner_id = current_partner.get("sub")

    # ── Real DB aggregates ─────────────────────────────────────────────────────
    # Import Order/Referral models if they exist; fall back to zeros gracefully
    total_orders = 0
    total_revenue = 0.0
    pending_referrals = 0
    commission_earned = 0.0
    commission_pending = 0.0
    active_patients = 0
    conversion_rate = 0.0

    try:
        from app.models.order import Order  # type: ignore
        from sqlalchemy import case

        orders_result = await db.execute(
            select(
                func.count(Order.id).label("total_orders"),
                func.coalesce(func.sum(Order.total_amount), 0).label("total_revenue"),
                func.coalesce(func.sum(Order.commission_amount), 0).label("commission_earned"),
                func.coalesce(
                    func.sum(
                        case((Order.status == "pending", Order.commission_amount), else_=0)
                    ),
                    0,
                ).label("commission_pending"),
            ).where(Order.partner_id == partner_id)
        )
        row = orders_result.first()
        if row:
            total_orders       = row.total_orders or 0
            total_revenue      = float(row.total_revenue or 0)
            commission_earned  = float(row.commission_earned or 0)
            commission_pending = float(row.commission_pending or 0)
    except ImportError:
        pass  # Order model not yet available

    try:
        from app.models.referral import Referral  # type: ignore

        ref_result = await db.execute(
            select(
                func.count(Referral.id).filter(Referral.status == "pending").label("pending"),
                func.count(Referral.id).filter(Referral.status == "converted").label("converted"),
                func.count(Referral.id).label("total"),
            ).where(Referral.partner_id == partner_id)
        )
        ref_row = ref_result.first()
        if ref_row:
            pending_referrals = ref_row.pending or 0
            active_patients   = ref_row.converted or 0
            if ref_row.total and ref_row.total > 0:
                conversion_rate = round(ref_row.converted / ref_row.total, 3)
    except ImportError:
        pass

    # ── Revenue trend (last 6 months) ─────────────────────────────────────────
    revenue_trend: List[RevenuePoint] = []
    try:
        from app.models.order import Order  # type: ignore

        month_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
        now = datetime.utcnow()
        for i in range(5, -1, -1):
            month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
            month_end   = (month_start + timedelta(days=32)).replace(day=1)
            tr = await db.execute(
                select(
                    func.coalesce(func.sum(Order.total_amount), 0).label("rev"),
                    func.coalesce(func.sum(Order.commission_amount), 0).label("comm"),
                ).where(
                    Order.partner_id == partner_id,
                    Order.created_at >= month_start,
                    Order.created_at < month_end,
                )
            )
            tr_row = tr.first()
            revenue_trend.append(
                RevenuePoint(
                    month=month_labels[month_start.month - 1],
                    revenue=float(tr_row.rev or 0),
                    commission=float(tr_row.comm or 0),
                )
            )
    except ImportError:
        # No Order model yet — return empty trend
        pass

    # ── Recent activity ───────────────────────────────────────────────────────
    recent_activity: List[dict] = []
    try:
        from app.models.order import Order  # type: ignore

        recent_result = await db.execute(
            select(Order)
            .where(Order.partner_id == partner_id)
            .order_by(Order.created_at.desc())
            .limit(5)
        )
        recent_orders = recent_result.scalars().all()
        for o in recent_orders:
            recent_activity.append({
                "id":        str(o.id),
                "type":      "order_placed",
                "patient":   getattr(o, "patient_name", None),
                "amount":    float(getattr(o, "total_amount", 0)),
                "timestamp": o.created_at.isoformat() if o.created_at else None,
            })
    except ImportError:
        pass

    return DashboardStats(
        total_orders=total_orders,
        total_revenue=total_revenue,
        pending_referrals=pending_referrals,
        commission_earned=commission_earned,
        commission_pending=commission_pending,
        active_patients=active_patients,
        conversion_rate=conversion_rate,
        revenue_trend=revenue_trend,
        recent_activity=recent_activity,
    )
