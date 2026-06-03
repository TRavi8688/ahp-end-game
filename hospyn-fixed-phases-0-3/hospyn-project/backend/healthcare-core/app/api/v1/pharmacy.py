from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
from typing import List

router = APIRouter(prefix="/pharmacy", tags=["pharmacy"])


@router.get("/inventory")
async def get_inventory(
    hospital_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """List all pharmacy inventory items for a hospital."""
    from sqlalchemy import select, text
    result = await db.execute(
        text("SELECT * FROM pharmacy_items WHERE hospital_id = :hid"),
        {"hid": hospital_id}
    )
    return result.mappings().all()


@router.post("/inventory")
async def add_stock(
    item: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Add new stock entry to pharmacy inventory."""
    from sqlalchemy import text
    await db.execute(
        text("""INSERT INTO pharmacy_items (name, quantity, hospital_id, unit_price)
                VALUES (:name, :quantity, :hospital_id, :unit_price)"""),
        item
    )
    await db.commit()
    return {"status": "success", "message": "Stock added"}


@router.get("/prescriptions/pending")
async def get_pending_prescriptions(
    hospital_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get all pending prescriptions awaiting dispensing."""
    from sqlalchemy import text
    result = await db.execute(
        text("SELECT * FROM prescriptions WHERE hospital_id = :hid AND status = 'pending'"),
        {"hid": hospital_id}
    )
    return result.mappings().all()


@router.post("/dispense/{prescription_id}")
async def dispense_prescription(
    prescription_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Mark a prescription as dispensed and deduct from inventory."""
    from sqlalchemy import text
    await db.execute(
        text("UPDATE prescriptions SET status='dispensed', dispensed_by=:uid WHERE id=:pid"),
        {"uid": str(current_user.id), "pid": prescription_id}
    )
    await db.commit()
    return {"status": "success", "message": "Prescription dispensed"}
