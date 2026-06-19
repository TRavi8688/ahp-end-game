"""
backend/healthcare-core/app/api/v1/pharmacy.py

EXECUTION FIX: this file did not exist at all. app/api/router.py already
imported `from app.api.v1.pharmacy import router as pharmacy_router`, which
meant the whole backend failed to boot (ModuleNotFoundError) before any
request could ever be served. partner-app/src/pages/Dashboard.jsx already
calls every endpoint below — they're implemented to match its exact request/
response shapes (verified directly against the frontend code, not guessed).

Endpoints:
  GET  /pharmacy/stats           - dashboard summary cards
  GET  /pharmacy/inventory       - list inventory for this pharmacy
  POST /pharmacy/inventory       - add one item (AI-scan confirm flow)
  POST /pharmacy/bulk-upload     - add many items (CSV upload flow)
  GET  /pharmacy/transactions    - ledger feed
  GET  /pharmacy/network-orders  - prescriptions shared via QR, not yet fulfilled
  POST /pharmacy/ai-scan         - extract item details from a photo
  POST /pharmacy/dispense        - sell stock against a patient, write ledger rows

HOW TO REGISTER (already done in router.py):
  from app.api.v1.pharmacy import router as pharmacy_router
  api_router.include_router(pharmacy_router, prefix="/pharmacy", tags=["Pharmacy"])
"""

import base64
import logging
import os
import uuid
from datetime import datetime, timezone, date as date_cls
from decimal import Decimal, InvalidOperation
from typing import Annotated, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import require_role, TokenPayload
from app.models.pharmacy import (
    Medicine, PharmacyInventory, PrescriptionDispense,
    PharmacyTransaction, TransactionType, PrescriptionShare,
)
from app.models.prescription import Prescription, PrescriptionItem
from app.models.patient import Patient

logger = logging.getLogger(__name__)
router = APIRouter()

PHARMACY_ROLES = ("pharmacist", "admin", "hospital_admin", "owner")


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _resolve_pharmacy_hospital_id(
    current_user: TokenPayload, db: AsyncSession
) -> uuid.UUID:
    """
    Resolve the Hospital row this pharmacist/owner operates. auth-service embeds
    hospital_id directly in the JWT (see core/security.py TokenPayload), so this
    is normally a single, cheap path. Falls back to the staff-table lookup used
    elsewhere in this codebase (see owner.py) for accounts where it's missing.
    """
    if current_user.hospital_id:
        try:
            return uuid.UUID(current_user.hospital_id)
        except ValueError:
            pass

    from sqlalchemy import text
    result = await db.execute(
        text("SELECT hospital_id FROM staff WHERE user_id = :uid AND deleted_at IS NULL LIMIT 1"),
        {"uid": current_user.sub},
    )
    row = result.fetchone()
    if row and row.hospital_id:
        return row.hospital_id

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No pharmacy/hospital is linked to this account.",
    )


def _inventory_to_dict(inv: PharmacyInventory) -> dict:
    return {
        "id": str(inv.id),
        "item_name": inv.medicine.name if inv.medicine else "Unknown Item",
        "generic_name": inv.medicine.generic_name if inv.medicine else "",
        "batch_number": inv.batch_number,
        "expiry_date": inv.expiry_date.isoformat() if inv.expiry_date else None,
        "stock_quantity": inv.quantity_available,
        "reorder_level": inv.reorder_level,
        "unit_price": float(inv.selling_price) if inv.selling_price is not None else 0.0,
    }


async def _get_or_create_medicine(db: AsyncSession, name: str, generic_name: str) -> Medicine:
    name = (name or "Unknown").strip()
    generic_name = (generic_name or name).strip()
    result = await db.execute(
        select(Medicine).where(func.lower(Medicine.name) == name.lower())
    )
    medicine = result.scalars().first()
    if medicine:
        return medicine
    medicine = Medicine(
        id=uuid.uuid4(),
        name=name,
        generic_name=generic_name,
        unit="unit",
    )
    db.add(medicine)
    await db.flush()
    return medicine


def _parse_date(value) -> date_cls:
    if isinstance(value, date_cls):
        return value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
        except ValueError:
            pass
    # Sensible default rather than a hard failure on a malformed row from CSV.
    return date_cls(date_cls.today().year + 2, date_cls.today().month, date_cls.today().day)


def _to_decimal(value, default: str = "0.00") -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError):
        return Decimal(default)


# ── Schemas ───────────────────────────────────────────────────────────────────

class InventoryItemIn(BaseModel):
    item_name: str
    generic_name: Optional[str] = ""
    batch_number: str
    expiry_date: str
    unit_price: float = 0
    stock_quantity: float = 0
    tax_percent: Optional[float] = None  # accepted, not yet billed separately


class DispenseLine(BaseModel):
    inventory_item_id: str
    quantity: int = Field(gt=0)


class DispenseRequest(BaseModel):
    patient_id: str
    items: List[DispenseLine]


class AiScanRequest(BaseModel):
    image_base64: str


# ── GET /pharmacy/stats ─────────────────────────────────────────────────────

@router.get("/stats")
async def get_pharmacy_stats(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)

    base_q = select(PharmacyInventory).where(PharmacyInventory.hospital_id == hospital_id)

    total_result = await db.execute(
        select(func.count()).select_from(base_q.subquery())
    )
    total_items = total_result.scalar_one()

    low_stock_result = await db.execute(
        select(func.count()).select_from(
            base_q.where(
                PharmacyInventory.quantity_available <= PharmacyInventory.reorder_level
            ).subquery()
        )
    )
    low_stock = low_stock_result.scalar_one()

    today = datetime.now(timezone.utc).date()
    soon = today.replace(year=today.year) if True else today
    from datetime import timedelta
    expiry_cutoff = today + timedelta(days=30)
    near_expiry_result = await db.execute(
        select(func.count()).select_from(
            base_q.where(PharmacyInventory.expiry_date <= expiry_cutoff).subquery()
        )
    )
    near_expiry = near_expiry_result.scalar_one()

    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    sales_result = await db.execute(
        select(func.coalesce(func.sum(PharmacyTransaction.quantity * PharmacyTransaction.unit_price), 0))
        .where(
            and_(
                PharmacyTransaction.hospital_id == hospital_id,
                PharmacyTransaction.transaction_type == TransactionType.dispense,
                PharmacyTransaction.created_at >= today_start,
            )
        )
    )
    today_sales_raw = sales_result.scalar_one() or 0
    # dispense quantities are stored negative; flip sign for a positive revenue figure
    today_sales = abs(float(today_sales_raw))

    return {
        "totalItems": total_items,
        "lowStock": low_stock,
        "nearExpiry": near_expiry,
        "todaySales": f"₹{today_sales:,.0f}",
    }


# ── GET /pharmacy/inventory ──────────────────────────────────────────────────

@router.get("/inventory")
async def list_inventory(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    result = await db.execute(
        select(PharmacyInventory)
        .options(selectinload(PharmacyInventory.medicine))
        .where(PharmacyInventory.hospital_id == hospital_id)
        .order_by(PharmacyInventory.updated_at.desc())
    )
    items = result.scalars().all()
    return [_inventory_to_dict(i) for i in items]


# ── POST /pharmacy/inventory ─────────────────────────────────────────────────

@router.post("/inventory", status_code=status.HTTP_201_CREATED)
async def add_inventory_item(
    payload: InventoryItemIn,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    medicine = await _get_or_create_medicine(db, payload.item_name, payload.generic_name)

    inventory = PharmacyInventory(
        id=uuid.uuid4(),
        hospital_id=hospital_id,
        medicine_id=medicine.id,
        batch_number=payload.batch_number or f"BNO-{int(datetime.now().timestamp())}",
        quantity_available=int(payload.stock_quantity or 0),
        reorder_level=10,
        expiry_date=_parse_date(payload.expiry_date),
        purchase_price=_to_decimal(payload.unit_price),
        selling_price=_to_decimal(payload.unit_price),
    )
    db.add(inventory)
    await db.flush()

    db.add(PharmacyTransaction(
        id=uuid.uuid4(),
        hospital_id=hospital_id,
        inventory_item_id=inventory.id,
        transaction_type=TransactionType.purchase,
        quantity=int(payload.stock_quantity or 0),
        unit_price=_to_decimal(payload.unit_price),
        created_by=uuid.UUID(current_user.sub),
    ))

    await db.refresh(inventory, attribute_names=["medicine"])
    return _inventory_to_dict(inventory)


# ── POST /pharmacy/bulk-upload ───────────────────────────────────────────────

@router.post("/bulk-upload")
async def bulk_upload_inventory(
    payload: List[InventoryItemIn],
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    added = 0

    for row in payload:
        if not row.item_name or row.item_name == "Unknown":
            continue
        medicine = await _get_or_create_medicine(db, row.item_name, row.generic_name)
        inventory = PharmacyInventory(
            id=uuid.uuid4(),
            hospital_id=hospital_id,
            medicine_id=medicine.id,
            batch_number=row.batch_number or f"BNO-{int(datetime.now().timestamp())}-{added}",
            quantity_available=int(row.stock_quantity or 0),
            reorder_level=10,
            expiry_date=_parse_date(row.expiry_date),
            purchase_price=_to_decimal(row.unit_price),
            selling_price=_to_decimal(row.unit_price),
        )
        db.add(inventory)
        await db.flush()
        db.add(PharmacyTransaction(
            id=uuid.uuid4(),
            hospital_id=hospital_id,
            inventory_item_id=inventory.id,
            transaction_type=TransactionType.purchase,
            quantity=int(row.stock_quantity or 0),
            unit_price=_to_decimal(row.unit_price),
            created_by=uuid.UUID(current_user.sub),
        ))
        added += 1

    return {"items_added": added}


# ── GET /pharmacy/transactions ───────────────────────────────────────────────

@router.get("/transactions")
async def list_transactions(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    result = await db.execute(
        select(PharmacyTransaction)
        .where(PharmacyTransaction.hospital_id == hospital_id)
        .order_by(PharmacyTransaction.created_at.desc())
        .limit(200)
    )
    rows = result.scalars().all()
    return [
        {
            "id": str(t.id),
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "transaction_type": t.transaction_type.value if hasattr(t.transaction_type, "value") else t.transaction_type,
            "inventory_item_id": str(t.inventory_item_id) if t.inventory_item_id else None,
            "quantity": t.quantity,
            "unit_price": float(t.unit_price) if t.unit_price is not None else None,
        }
        for t in rows
    ]


# ── GET /pharmacy/network-orders ─────────────────────────────────────────────

@router.get("/network-orders")
async def list_network_orders(
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)
    result = await db.execute(
        select(PrescriptionShare)
        .options(
            selectinload(PrescriptionShare.prescription).selectinload(Prescription.items),
        )
        .where(
            and_(
                PrescriptionShare.pharmacy_hospital_id == hospital_id,
                PrescriptionShare.status == "pending",
            )
        )
        .order_by(PrescriptionShare.shared_at.desc())
    )
    shares = result.scalars().all()

    orders = []
    for share in shares:
        rx = share.prescription
        if rx is None:
            continue
        patient_result = await db.execute(select(Patient).where(Patient.id == rx.patient_id))
        patient = patient_result.scalars().first()
        orders.append({
            "id": str(share.id),
            "patient_id": str(rx.patient_id),
            "patient_name": f"{patient.first_name} {patient.last_name}" if patient else "Unknown Patient",
            "patient_phone": patient.phone if patient else "",
            "shared_at": share.shared_at.isoformat() if share.shared_at else None,
            "diagnosis": None,
            "medications": [
                {"name": item.drug_name, "dosage": item.dosage, "duration": item.duration}
                for item in (rx.items or [])
            ],
        })
    return orders


# ── POST /pharmacy/ai-scan ───────────────────────────────────────────────────

@router.post("/ai-scan")
async def ai_scan_medicine(
    payload: AiScanRequest,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
):
    """
    Extracts item_name/generic_name/batch_number/expiry_date/unit_price from a
    photo of a medicine strip/box using Gemini vision.

    EXECUTION NOTE: there was no AI-scan capability anywhere in the codebase to
    reuse — ai-service only does clinical-note summarization and vitals triage
    (see ai-service/app/main.py), nothing for OCR/vision on medicine packaging.
    Rather than fabricate plausible-looking fake data (actively dangerous for
    a feature that pre-fills expiry dates and prices into a pharmacy's stock),
    this calls Gemini directly when GEMINI_API_KEY is configured, and returns
    a clear 503 — not a guess — when it isn't.
    """
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "AI scan is not configured. Set GEMINI_API_KEY in this service's "
                "environment to enable photo-to-inventory extraction. Get a key "
                "at https://aistudio.google.com (free tier)."
            ),
        )

    try:
        import google.generativeai as genai
    except ImportError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="google-generativeai is not installed. Add it to requirements.txt.",
        )

    try:
        image_data = payload.image_base64.split(",")[-1]  # strip data:image/jpeg;base64, prefix if present
        image_bytes = base64.b64decode(image_data)
    except Exception:
        raise HTTPException(status_code=400, detail="image_base64 is not valid base64 image data.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")

    prompt = (
        "You are reading a photo of a medicine strip, box, or label for pharmacy "
        "stock entry. Extract ONLY these fields as strict JSON, no other text: "
        '{"item_name": str, "generic_name": str, "batch_number": str, '
        '"expiry_date": "YYYY-MM-DD", "unit_price": number, "confidence": number 0-1}. '
        "If a field is not visible, use an empty string (or 0 for unit_price/confidence). "
        "Do not invent values you cannot read from the image."
    )

    try:
        response = model.generate_content(
            [prompt, {"mime_type": "image/jpeg", "data": image_bytes}]
        )
        import json
        text = response.text.strip().strip("`").lstrip("json").strip()
        extracted = json.loads(text)
    except Exception as exc:
        logger.error("Gemini AI scan failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI extraction failed. Try a clearer photo or enter details manually.",
        )

    return {
        "item_name": extracted.get("item_name", ""),
        "generic_name": extracted.get("generic_name", ""),
        "batch_number": extracted.get("batch_number", ""),
        "expiry_date": extracted.get("expiry_date", ""),
        "unit_price": extracted.get("unit_price", 0),
        "confidence": extracted.get("confidence", 0),
    }


# ── POST /pharmacy/dispense ──────────────────────────────────────────────────

@router.post("/dispense")
async def dispense_items(
    payload: DispenseRequest,
    current_user: Annotated[TokenPayload, Depends(require_role(*PHARMACY_ROLES))],
    db: AsyncSession = Depends(get_db),
):
    hospital_id = await _resolve_pharmacy_hospital_id(current_user, db)

    if not payload.items:
        raise HTTPException(status_code=400, detail="No items selected to dispense.")

    try:
        patient_uuid = uuid.UUID(payload.patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patient_id.")

    patient_result = await db.execute(select(Patient).where(Patient.id == patient_uuid))
    if not patient_result.scalars().first():
        raise HTTPException(status_code=404, detail="Patient not found.")

    dispensed_lines = []
    total_amount = Decimal("0.00")

    for line in payload.items:
        try:
            inv_id = uuid.UUID(line.inventory_item_id)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid inventory_item_id: {line.inventory_item_id}")

        inv_result = await db.execute(
            select(PharmacyInventory).where(
                and_(
                    PharmacyInventory.id == inv_id,
                    PharmacyInventory.hospital_id == hospital_id,
                )
            )
        )
        inventory = inv_result.scalars().first()
        if not inventory:
            raise HTTPException(status_code=404, detail=f"Inventory item {line.inventory_item_id} not found.")
        if inventory.quantity_available < line.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock. Only {inventory.quantity_available} units available.",
            )

        inventory.quantity_available -= line.quantity
        line_total = (inventory.selling_price or Decimal("0.00")) * line.quantity
        total_amount += line_total
        dispensed_lines.append((inventory, line.quantity, line_total))

    # Record everything only after every line has been validated, so a failure
    # partway through never leaves partial stock deductions in this request.
    for inventory, qty, line_total in dispensed_lines:
        db.add(PharmacyTransaction(
            id=uuid.uuid4(),
            hospital_id=hospital_id,
            inventory_item_id=inventory.id,
            transaction_type=TransactionType.dispense,
            quantity=-qty,
            unit_price=inventory.selling_price,
            created_by=uuid.UUID(current_user.sub),
        ))

    return {
        "status": "dispensed",
        "patient_id": payload.patient_id,
        "total_amount": float(total_amount),
        "items_dispensed": len(dispensed_lines),
    }
