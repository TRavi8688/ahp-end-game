# backend/healthcare-core/app/api/v1/partner_lab.py
# Lab dashboard API
# Handles: test orders (from patient app + manual), sample QR, result upload, report delivery

import uuid
import secrets
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_partner
from app.models.partner import Partner
from app.models.lab_order import LabOrder, LabTest
from shared.notifications import send_push_notification
from shared.pdf_generator import generate_lab_report_pdf
from shared.storage import upload_to_storage

router = APIRouter()


# ── Schemas ───────────────────────────────────────────────────────────────────

class ManualTestIn(BaseModel):
    test_name:    str
    test_code:    str
    price:        float
    normal_range: str
    unit:         str


class ManualLabOrderIn(BaseModel):
    name:  str
    phone: str
    tests: List[ManualTestIn]
    notes: str = ""


class ResultItemIn(BaseModel):
    test_code:    str
    test_name:    str
    result_value: str
    normal_range: str
    unit:         str


class SubmitResultsIn(BaseModel):
    results: List[ResultItemIn]


class LabTestOut(BaseModel):
    test_name:    str
    test_code:    str
    normal_range: str
    unit:         str
    result_value: Optional[str]
    is_abnormal:  Optional[bool]


class LabOrderOut(BaseModel):
    id:            str
    order_number:  str
    patient_name:  str
    patient_phone: str
    patient_id:    Optional[str]
    source:        str
    status:        str
    tests:         List[LabTestOut]
    sample_qr:     Optional[str]
    report_url:    Optional[str]
    total_amount:  float
    created_at:    datetime
    notes:         str


def _order_to_out(order: LabOrder) -> dict:
    return {
        "id":            str(order.id),
        "order_number":  order.order_number,
        "patient_name":  order.patient_name,
        "patient_phone": order.patient_phone,
        "patient_id":    str(order.patient_id) if order.patient_id else None,
        "source":        order.source,
        "status":        order.status,
        "tests":         [
            {
                "test_name":    t.test_name,
                "test_code":    t.test_code,
                "normal_range": t.normal_range,
                "unit":         t.unit,
                "result_value": t.result_value,
                "is_abnormal":  t.is_abnormal,
            }
            for t in (order.tests or [])
        ],
        "sample_qr":    order.sample_qr,
        "report_url":   order.report_url,
        "total_amount": order.total_amount,
        "created_at":   order.created_at,
        "notes":        order.notes or "",
    }


def _check_abnormal(result_value: str, normal_range: str) -> bool:
    """
    Simple numeric range checker.
    normal_range examples: "4.0-11.0", "<200", ">60"
    Returns True if result is outside normal range.
    """
    try:
        val = float(result_value.replace(",", ".").strip())
        r   = normal_range.strip()
        if "-" in r and not r.startswith("<") and not r.startswith(">"):
            lo, hi = r.split("-", 1)
            return not (float(lo) <= val <= float(hi))
        elif r.startswith("<="):
            return val > float(r[2:])
        elif r.startswith(">="):
            return val < float(r[2:])
        elif r.startswith("<"):
            return val >= float(r[1:])
        elif r.startswith(">"):
            return val <= float(r[1:])
    except Exception:
        pass
    return False


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/lab/orders", response_model=List[dict])
async def get_lab_orders(
    status:  Optional[str] = None,
    db:      AsyncSession  = Depends(get_db),
    partner: Partner       = Depends(get_current_partner),
):
    query = select(LabOrder).where(
        LabOrder.partner_id == partner.id
    ).order_by(LabOrder.created_at.desc())

    if status:
        query = query.where(LabOrder.status == status)

    result = await db.execute(query)
    orders = result.scalars().all()
    return [_order_to_out(o) for o in orders]


@router.post("/lab/orders/manual", response_model=dict)
async def add_manual_lab_order(
    body:    ManualLabOrderIn,
    db:      AsyncSession = Depends(get_db),
    partner: Partner      = Depends(get_current_partner),
):
    """Staff adds a walk-in patient for lab tests manually."""
    order_num = f"LAB-{datetime.utcnow().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    total     = sum(t.price for t in body.tests)

    tests = [
        LabTest(
            id=uuid.uuid4(),
            test_name=t.test_name,
            test_code=t.test_code,
            normal_range=t.normal_range,
            unit=t.unit,
            price=t.price,
        )
        for t in body.tests
    ]

    order = LabOrder(
        id=uuid.uuid4(),
        partner_id=partner.id,
        order_number=order_num,
        patient_name=body.name,
        patient_phone=body.phone,
        patient_id=None,
        source="manual",
        status="pending",
        tests=tests,
        total_amount=total,
        notes=body.notes,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return _order_to_out(order)


@router.post("/lab/orders/{order_id}/collect-sample", response_model=dict)
async def collect_sample(
    order_id: str,
    db:       AsyncSession = Depends(get_db),
    partner:  Partner      = Depends(get_current_partner),
):
    """Mark sample collected and generate unique QR label for chain of custody."""
    result = await db.execute(
        select(LabOrder).where(
            LabOrder.id == uuid.UUID(order_id),
            LabOrder.partner_id == partner.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "pending":
        raise HTTPException(status_code=400, detail=f"Cannot collect — status: {order.status}")

    # Generate QR string: unique per sample for chain of custody tracking
    sample_qr = f"SMPL-{str(order.id)[:8].upper()}-{secrets.token_hex(4).upper()}"

    order.status             = "sample_collected"
    order.sample_qr          = sample_qr
    order.sample_collected_at = datetime.utcnow()
    order.updated_at         = datetime.utcnow()
    await db.commit()
    await db.refresh(order)

    # Notify patient if they have the app
    if order.patient_id:
        await send_push_notification(
            user_id=str(order.patient_id),
            title="Sample Collected",
            body=f"Your sample has been collected. We'll notify you when results are ready.",
            data={"type": "lab_sample_collected", "order_id": str(order.id)},
        )

    return _order_to_out(order)


@router.post("/lab/orders/{order_id}/start-processing", response_model=dict)
async def start_processing(
    order_id: str,
    db:       AsyncSession = Depends(get_db),
    partner:  Partner      = Depends(get_current_partner),
):
    result = await db.execute(
        select(LabOrder).where(
            LabOrder.id == uuid.UUID(order_id),
            LabOrder.partner_id == partner.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "sample_collected":
        raise HTTPException(status_code=400, detail="Sample must be collected first")

    order.status      = "processing"
    order.updated_at  = datetime.utcnow()
    await db.commit()
    await db.refresh(order)
    return _order_to_out(order)


@router.post("/lab/orders/{order_id}/submit-results", response_model=dict)
async def submit_results(
    order_id: str,
    body:     SubmitResultsIn,
    db:       AsyncSession = Depends(get_db),
    partner:  Partner      = Depends(get_current_partner),
):
    """Staff enters result values. System auto-flags abnormals."""
    result = await db.execute(
        select(LabOrder).where(
            LabOrder.id == uuid.UUID(order_id),
            LabOrder.partner_id == partner.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "processing":
        raise HTTPException(status_code=400, detail="Order must be in processing state")

    # Map results onto tests
    results_map = {r.test_code: r for r in body.results}
    for test in (order.tests or []):
        r = results_map.get(test.test_code)
        if r:
            test.result_value = r.result_value
            test.is_abnormal  = _check_abnormal(r.result_value, test.normal_range)

    order.status      = "result_ready"
    order.updated_at  = datetime.utcnow()
    await db.commit()
    await db.refresh(order)
    return _order_to_out(order)


@router.post("/lab/orders/{order_id}/send-report", response_model=dict)
async def send_report(
    order_id:         str,
    background_tasks: BackgroundTasks,
    db:               AsyncSession = Depends(get_db),
    partner:          Partner      = Depends(get_current_partner),
):
    """Generate PDF report and send to patient. Lab person is responsible for accuracy."""
    result = await db.execute(
        select(LabOrder).where(
            LabOrder.id == uuid.UUID(order_id),
            LabOrder.partner_id == partner.id,
        )
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "result_ready":
        raise HTTPException(status_code=400, detail="Results must be submitted first")

    has_abnormal = any(t.is_abnormal for t in (order.tests or []))

    async def _generate_and_send():
        # Generate PDF
        pdf_bytes = await generate_lab_report_pdf(
            order_number=order.order_number,
            patient_name=order.patient_name,
            patient_phone=order.patient_phone,
            lab_name=partner.name,
            tests=[
                {
                    "test_name":    t.test_name,
                    "result_value": t.result_value,
                    "normal_range": t.normal_range,
                    "unit":         t.unit,
                    "is_abnormal":  t.is_abnormal,
                }
                for t in (order.tests or [])
            ],
            collected_at=order.sample_collected_at,
            reported_at=datetime.utcnow(),
        )

        # Upload to GCS/S3
        pdf_url = await upload_to_storage(
            data=pdf_bytes,
            path=f"reports/{partner.id}/{order.id}.pdf",
            content_type="application/pdf",
        )

        # Update order
        order.report_url  = pdf_url
        order.status      = "report_sent"
        order.reported_at = datetime.utcnow()
        order.updated_at  = datetime.utcnow()
        await db.commit()

        # Push to patient app
        if order.patient_id:
            await send_push_notification(
                user_id=str(order.patient_id),
                title="Your Lab Report is Ready" + (" ⚠️" if has_abnormal else " ✓"),
                body=f"Results from {partner.name} are available. Tap to view.",
                data={
                    "type":       "lab_report_ready",
                    "order_id":   str(order.id),
                    "report_url": pdf_url,
                    "has_abnormal": has_abnormal,
                },
            )

    background_tasks.add_task(_generate_and_send)

    # Return immediately — report generation is async
    order.status     = "report_sent"
    order.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(order)
    return _order_to_out(order)
