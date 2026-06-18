"""
Partner Referral Routes
GET /api/v1/partner/referrals
GET /api/v1/partner/referrals/stats
GET /api/v1/partner/referrals/payouts
GET /api/v1/partner/referrals/link
"""

import hashlib
import os
from datetime import datetime, timedelta
from typing import List, Optional

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db

router = APIRouter(prefix="", tags=["Partner Referrals"])
security = HTTPBearer()

SECRET_KEY   = os.environ.get("PARTNER_JWT_SECRET", "CHANGE_ME_IN_PRODUCTION")
ALGORITHM    = "HS256"
APP_BASE_URL = os.environ.get("APP_BASE_URL", "https://app.ahphealthcare.com")


def get_current_partner(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        return jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")


def make_referral_code(partner_id: str) -> str:
    """Deterministic short code derived from partner ID."""
    return hashlib.md5(partner_id.encode()).hexdigest()[:8].upper()


# ── Schemas ───────────────────────────────────────────────────────────────────
class Referral(BaseModel):
    id: str
    patient_name: str
    patient_phone: str
    referral_date: str
    registration_date: Optional[str]
    first_order_date: Optional[str]
    status: str              # clicked | registered | converted | churned
    commission_amount: float
    commission_status: str   # pending | paid | cancelled
    order_count: int
    lifetime_value: float


class ReferralStats(BaseModel):
    referral_code: str
    referral_url: str
    total_clicks: int
    total_registrations: int
    total_conversions: int
    conversion_rate: float
    total_commission_earned: float
    commission_pending: float
    commission_paid: float
    monthly_trend: List[dict]


class PayoutRecord(BaseModel):
    id: str
    amount: float
    status: str              # pending | processing | paid
    period_start: str
    period_end: str
    paid_at: Optional[str]
    transaction_ref: Optional[str]
    referral_count: int


class ReferralLinkResponse(BaseModel):
    referral_code: str
    referral_url: str
    qr_value: str


# ── Helper ────────────────────────────────────────────────────────────────────
def _row_to_referral(row) -> Referral:
    return Referral(
        id=str(row.id),
        patient_name=getattr(row, "patient_name", ""),
        patient_phone=getattr(row, "patient_phone", ""),
        referral_date=row.referral_date.isoformat() if getattr(row, "referral_date", None) else "",
        registration_date=row.registration_date.isoformat() if getattr(row, "registration_date", None) else None,
        first_order_date=row.first_order_date.isoformat() if getattr(row, "first_order_date", None) else None,
        status=row.status,
        commission_amount=float(getattr(row, "commission_amount", 0)),
        commission_status=getattr(row, "commission_status", "pending"),
        order_count=getattr(row, "order_count", 0),
        lifetime_value=float(getattr(row, "lifetime_value", 0)),
    )


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/referrals", response_model=List[Referral])
async def get_referrals(
    status: Optional[str] = Query(None),
    current_partner: dict = Depends(get_current_partner),
    db: AsyncSession = Depends(get_db),
):
    from app.models.referral import Referral as ReferralModel  # type: ignore

    partner_id = current_partner.get("sub")
    stmt = select(ReferralModel).where(ReferralModel.partner_id == partner_id)

    if status and status != "all":
        stmt = stmt.where(ReferralModel.status == status)

    stmt = stmt.order_by(ReferralModel.referral_date.desc())
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [_row_to_referral(r) for r in rows]


@router.get("/referrals/stats", response_model=ReferralStats)
async def get_referral_stats(
    current_partner: dict = Depends(get_current_partner),
    db: AsyncSession = Depends(get_db),
):
    from app.models.referral import Referral as ReferralModel  # type: ignore

    partner_id    = current_partner.get("sub", "")
    referral_code = make_referral_code(partner_id)
    referral_url  = f"{APP_BASE_URL}/register?ref={referral_code}"

    # Aggregate counts
    agg = await db.execute(
        select(
            func.count(ReferralModel.id).label("total"),
            func.count(ReferralModel.id).filter(
                ReferralModel.status == "converted"
            ).label("conversions"),
            func.count(ReferralModel.id).filter(
                ReferralModel.status.in_(["registered", "converted"])
            ).label("registrations"),
            func.coalesce(
                func.sum(ReferralModel.commission_amount).filter(
                    ReferralModel.commission_status == "paid"
                ),
                0,
            ).label("paid"),
            func.coalesce(
                func.sum(ReferralModel.commission_amount).filter(
                    ReferralModel.commission_status == "pending"
                ),
                0,
            ).label("pending"),
        ).where(ReferralModel.partner_id == partner_id)
    )
    row = agg.first()

    total         = row.total or 0
    conversions   = row.conversions or 0
    registrations = row.registrations or 0
    commission_paid    = float(row.paid or 0)
    commission_pending = float(row.pending or 0)
    total_earned       = commission_paid + commission_pending
    conversion_rate    = round(conversions / total, 3) if total > 0 else 0.0

    # Monthly trend (last 6 months)
    month_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    monthly_trend = []
    now = datetime.utcnow()
    for i in range(5, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(day=1)
        month_end   = (month_start + timedelta(days=32)).replace(day=1)
        tr = await db.execute(
            select(
                func.count(ReferralModel.id).label("clicks"),
                func.count(ReferralModel.id).filter(
                    ReferralModel.status.in_(["registered", "converted"])
                ).label("regs"),
                func.count(ReferralModel.id).filter(
                    ReferralModel.status == "converted"
                ).label("convs"),
            ).where(
                ReferralModel.partner_id == partner_id,
                ReferralModel.referral_date >= month_start,
                ReferralModel.referral_date < month_end,
            )
        )
        tr_row = tr.first()
        monthly_trend.append({
            "month":         month_labels[month_start.month - 1],
            "clicks":        tr_row.clicks or 0,
            "registrations": tr_row.regs or 0,
            "conversions":   tr_row.convs or 0,
        })

    return ReferralStats(
        referral_code=referral_code,
        referral_url=referral_url,
        total_clicks=total,
        total_registrations=registrations,
        total_conversions=conversions,
        conversion_rate=conversion_rate,
        total_commission_earned=total_earned,
        commission_pending=commission_pending,
        commission_paid=commission_paid,
        monthly_trend=monthly_trend,
    )


@router.get("/referrals/payouts", response_model=List[PayoutRecord])
async def get_payouts(
    current_partner: dict = Depends(get_current_partner),
    db: AsyncSession = Depends(get_db),
):
    from app.models.payout import Payout  # type: ignore

    partner_id = current_partner.get("sub")
    result = await db.execute(
        select(Payout)
        .where(Payout.partner_id == partner_id)
        .order_by(Payout.period_start.desc())
    )
    rows = result.scalars().all()
    return [
        PayoutRecord(
            id=str(r.id),
            amount=float(r.amount),
            status=r.status,
            period_start=r.period_start.isoformat() if r.period_start else "",
            period_end=r.period_end.isoformat() if r.period_end else "",
            paid_at=r.paid_at.isoformat() if getattr(r, "paid_at", None) else None,
            transaction_ref=getattr(r, "transaction_ref", None),
            referral_count=getattr(r, "referral_count", 0),
        )
        for r in rows
    ]


@router.get("/referrals/link", response_model=ReferralLinkResponse)
async def get_referral_link(
    current_partner: dict = Depends(get_current_partner),
):
    partner_id    = current_partner.get("sub", "")
    referral_code = make_referral_code(partner_id)
    referral_url  = f"{APP_BASE_URL}/register?ref={referral_code}"

    return ReferralLinkResponse(
        referral_code=referral_code,
        referral_url=referral_url,
        qr_value=referral_url,
    )
