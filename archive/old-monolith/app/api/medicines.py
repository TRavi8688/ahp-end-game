from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from typing import List, Dict, Any

from app.core.database import get_db
from app.models.medicine import MedicineDirectory

router = APIRouter(prefix="/medicines", tags=["medicines"])

@router.get("/search")
async def search_medicines(
    q: str = Query(..., min_length=2, description="Search term for brand or generic name"),
    limit: int = Query(20, le=50),
    db: AsyncSession = Depends(get_db)
):
    """
    Search for medicines by brand name or generic name.
    Useful for type-ahead autocomplete in prescription builder.
    """
    term = f"%{q.lower()}%"
    
    stmt = select(MedicineDirectory).where(
        or_(
            func.lower(MedicineDirectory.name).like(term),
            func.lower(MedicineDirectory.generic_name).like(term)
        )
    ).limit(limit)
    
    result = await db.execute(stmt)
    medicines = result.scalars().all()
    
    response = []
    for med in medicines:
        response.append({
            "id": str(med.id),
            "name": med.name,
            "generic_name": med.generic_name,
            "dosage_form": med.dosage_form,
            "common_dosages": med.common_dosages,
            "manufacturer": med.manufacturer
        })
        
    return {"results": response}
