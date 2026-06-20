"""
Pharmacy Routes — wired to real DB
GET   /api/v1/pharmacy/dashboard
GET   /api/v1/pharmacy/dashboard/weekly-dispensing
GET   /api/v1/pharmacy/inventory
PATCH /api/v1/pharmacy/inventory/{medicine_id}/restock
GET   /api/v1/pharmacy/prescriptions
PATCH /api/v1/pharmacy/prescriptions/{prescription_id}/dispense
GET   /api/v1/pharmacy/medicine/scan
"""

from datetime import date, datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.pharmacy import Medicine, PharmacyInventory, PrescriptionDispense

router = APIRouter(tags=["Pharmacy"])

# ── Try to import the Prescription model (created elsewhere in the codebase) ──
try:
    from app.models.prescription import Prescription  # type: ignore
    _HAS_PRESCRIPTION = True
except ImportError:
    _HAS_PRESCRIPTION = False


# ── Schemas ───────────────────────────────────────────────────────────────────
class DashboardResponse(BaseModel):
    low_stock_count: int
    expiring_soon_count: int
    pending_prescriptions: int
    dispensed_today: int


class WeeklyDispensingPoint(BaseModel):
    date: str
    dispensed: int


class InventoryItemResponse(BaseModel):
    id: str
    medicine_name: str
    generic_name: str
    category: Optional[str]
    batch_number: str
    expiry_date: str
    quantity_available: int
    reorder_level: int
    selling_price: float
    manufacturer: Optional[str]


class RestockRequest(BaseModel):
    quantity: int


class PrescriptionResponse(BaseModel):
    id: str
    status: str
    created_at: str
    patient_name: Optional[str] = None
    medicine_name: Optional[str] = None
    dispensed_at: Optional[str] = None


class ScanResponse(BaseModel):
    found: bool
    medicine: Optional[dict] = None
    message: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=DashboardResponse)
async def get_dashboard(
    hospital_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Dashboard KPIs: low stock count, expiring soon, prescriptions."""
    today = date.today()
    expiry_threshold = today + timedelta(days=30)

    # Low stock items (quantity_available <= reorder_level)
    low_stock_stmt = select(func.count(PharmacyInventory.id)).where(
        PharmacyInventory.quantity_available <= PharmacyInventory.reorder_level
    )
    if hospital_id:
        low_stock_stmt = low_stock_stmt.where(PharmacyInventory.hospital_id == hospital_id)
    low_stock_result = await db.execute(low_stock_stmt)
    low_stock_count = low_stock_result.scalar() or 0

    # Expiring soon (within 30 days)
    expiring_stmt = select(func.count(PharmacyInventory.id)).where(
        PharmacyInventory.expiry_date <= expiry_threshold,
        PharmacyInventory.expiry_date >= today,
    )
    if hospital_id:
        expiring_stmt = expiring_stmt.where(PharmacyInventory.hospital_id == hospital_id)
    expiring_result = await db.execute(expiring_stmt)
    expiring_soon_count = expiring_result.scalar() or 0

    # Prescription counts (today)
    pending_prescriptions = 0
    dispensed_today = 0
    if _HAS_PRESCRIPTION:
        pending_stmt = select(func.count(Prescription.id)).where(
            Prescription.status == "pending",
            func.date(Prescription.created_at) == today,
        )
        if hospital_id:
            pending_stmt = pending_stmt.where(Prescription.hospital_id == hospital_id)
        pending_result = await db.execute(pending_stmt)
        pending_prescriptions = pending_result.scalar() or 0

        dispensed_stmt = select(func.count(Prescription.id)).where(
            Prescription.status == "dispensed",
            func.date(Prescription.created_at) == today,
        )
        if hospital_id:
            dispensed_stmt = dispensed_stmt.where(Prescription.hospital_id == hospital_id)
        dispensed_result = await db.execute(dispensed_stmt)
        dispensed_today = dispensed_result.scalar() or 0

    return DashboardResponse(
        low_stock_count=low_stock_count,
        expiring_soon_count=expiring_soon_count,
        pending_prescriptions=pending_prescriptions,
        dispensed_today=dispensed_today,
    )


@router.get("/dashboard/weekly-dispensing", response_model=List[WeeklyDispensingPoint])
async def get_weekly_dispensing(
    hospital_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Weekly dispensing volume: count of dispensed prescriptions per day for last 7 days."""
    trend = []

    if _HAS_PRESCRIPTION:
        today = date.today()
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            stmt = select(func.count(Prescription.id)).where(
                Prescription.status == "dispensed",
                func.date(Prescription.created_at) == day,
            )
            if hospital_id:
                stmt = stmt.where(Prescription.hospital_id == hospital_id)
            result = await db.execute(stmt)
            count = result.scalar() or 0
            trend.append(WeeklyDispensingPoint(date=day.isoformat(), dispensed=count))
    else:
        # No Prescription model — return zeroes for last 7 days
        today = date.today()
        for i in range(6, -1, -1):
            day = today - timedelta(days=i)
            trend.append(WeeklyDispensingPoint(date=day.isoformat(), dispensed=0))

    return trend


@router.get("/inventory", response_model=List[InventoryItemResponse])
async def get_inventory(
    hospital_id: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """List pharmacy inventory, optionally filtered by hospital."""
    stmt = (
        select(PharmacyInventory, Medicine)
        .join(Medicine, PharmacyInventory.medicine_id == Medicine.id)
        .offset((page - 1) * limit)
        .limit(limit)
    )
    if hospital_id:
        stmt = stmt.where(PharmacyInventory.hospital_id == hospital_id)

    result = await db.execute(stmt)
    rows = result.all()

    items = []
    for inv, med in rows:
        items.append(
            InventoryItemResponse(
                id=str(inv.id),
                medicine_name=med.name,
                generic_name=med.generic_name,
                category=med.category,
                batch_number=inv.batch_number,
                expiry_date=str(inv.expiry_date),
                quantity_available=inv.quantity_available,
                reorder_level=inv.reorder_level,
                selling_price=float(inv.selling_price),
                manufacturer=med.manufacturer,
            )
        )
    return items


@router.patch("/inventory/{medicine_id}/restock")
async def restock_medicine(
    medicine_id: str,
    body: RestockRequest,
    db: AsyncSession = Depends(get_db),
):
    """Add quantity to a pharmacy inventory item's stock."""
    result = await db.execute(
        select(PharmacyInventory).where(PharmacyInventory.id == medicine_id)
    )
    inv = result.scalars().first()
    if not inv:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    inv.quantity_available += body.quantity
    await db.commit()

    return {
        "success":            True,
        "id":                 medicine_id,
        "quantity_available": inv.quantity_available,
        "added":              body.quantity,
        "updated_at":         datetime.utcnow().isoformat(),
    }


@router.get("/prescriptions", response_model=List[PrescriptionResponse])
async def get_prescriptions(
    status: Optional[str] = Query("pending"),
    date_filter: Optional[str] = Query(None, alias="date"),
    hospital_id: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """List prescriptions, filtered by status and date."""
    if not _HAS_PRESCRIPTION:
        return []

    filter_date = date.today()
    if date_filter and date_filter != "today":
        try:
            filter_date = date.fromisoformat(date_filter)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    stmt = select(Prescription).where(
        func.date(Prescription.created_at) == filter_date
    )
    if status:
        stmt = stmt.where(Prescription.status == status)
    if hospital_id:
        stmt = stmt.where(Prescription.hospital_id == hospital_id)

    stmt = stmt.order_by(Prescription.created_at.desc())
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        PrescriptionResponse(
            id=str(r.id),
            status=r.status,
            created_at=r.created_at.isoformat() if r.created_at else "",
            patient_name=getattr(r, "patient_name", None),
            medicine_name=getattr(r, "medicine_name", None),
            dispensed_at=(
                r.dispensed_at.isoformat()
                if getattr(r, "dispensed_at", None)
                else None
            ),
        )
        for r in rows
    ]


@router.patch("/prescriptions/{prescription_id}/dispense")
async def dispense_prescription(
    prescription_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Mark a prescription as dispensed."""
    if not _HAS_PRESCRIPTION:
        raise HTTPException(status_code=503, detail="Prescription model not available")

    result = await db.execute(
        select(Prescription).where(Prescription.id == prescription_id)
    )
    rx = result.scalars().first()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if rx.status == "dispensed":
        raise HTTPException(status_code=400, detail="Prescription already dispensed")

    rx.status = "dispensed"
    if hasattr(rx, "dispensed_at"):
        rx.dispensed_at = datetime.utcnow()

    await db.commit()

    return {
        "success":        True,
        "id":             prescription_id,
        "status":         "dispensed",
        "dispensed_at":   datetime.utcnow().isoformat(),
    }


@router.get("/medicine/scan", response_model=ScanResponse)
async def scan_medicine(
    barcode: str = Query(..., description="Barcode or QR value from scanner"),
    db: AsyncSession = Depends(get_db),
):
    """Look up a medicine by barcode."""
    result = await db.execute(
        select(Medicine).where(Medicine.barcode == barcode)  # type: ignore[attr-defined]
    )
    med = result.scalars().first()

    if not med:
        # Try via inventory batch_number as fallback
        result2 = await db.execute(
            select(PharmacyInventory, Medicine)
            .join(Medicine, PharmacyInventory.medicine_id == Medicine.id)
            .where(PharmacyInventory.batch_number == barcode)
        )
        row = result2.first()
        if row:
            inv, med = row
        else:
            return ScanResponse(found=False, message=f"No medicine found for barcode: {barcode}")

    return ScanResponse(
        found=True,
        medicine={
            "id":           str(med.id),
            "name":         med.name,
            "generic_name": med.generic_name,
            "category":     med.category,
            "unit":         med.unit,
            "manufacturer": med.manufacturer,
        },
        message="Medicine found",
    )
