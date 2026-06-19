from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.security import get_current_user
import uuid

router = APIRouter(prefix="/lab", tags=["lab"])


@router.post("/orders")
async def create_lab_order(
    order: dict,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Create a new lab test order for a patient."""
    from sqlalchemy import text
    order_id = str(uuid.uuid4())
    await db.execute(
        text("""INSERT INTO lab_orders (id, patient_id, hospital_id, test_name, ordered_by, status)
                VALUES (:id, :patient_id, :hospital_id, :test_name, :ordered_by, 'ordered')"""),
        {**order, "id": order_id, "ordered_by": str(current_user.id)}
    )
    await db.commit()
    return {"status": "success", "order_id": order_id}


@router.get("/orders/{order_id}")
async def get_lab_order(
    order_id: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Get details of a specific lab order."""
    from sqlalchemy import text
    result = await db.execute(
        text("SELECT * FROM lab_orders WHERE id = :id"),
        {"id": order_id}
    )
    order = result.mappings().first()
    if not order:
        raise HTTPException(status_code=404, detail="Lab order not found")
    return order


@router.patch("/samples/{order_id}/status")
async def update_sample_status(
    order_id: str,
    status: str,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Update sample status: ordered → sample_collected → processing → report_ready."""
    valid_statuses = ["ordered", "sample_collected", "processing", "report_ready", "delivered"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {valid_statuses}")
    from sqlalchemy import text
    await db.execute(
        text("UPDATE lab_orders SET status = :status WHERE id = :id"),
        {"status": status, "id": order_id}
    )
    await db.commit()
    return {"status": "success", "order_id": order_id, "new_status": status}


@router.post("/results/upload")
async def upload_lab_result(
    order_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user)
):
    """Upload lab result PDF/image and link to the order."""
    # TODO: Wire GCS upload — use same pattern as medical records signed URLs
    # gcs_url = await upload_to_gcs(file, folder=f"lab_results/{order_id}")
    gcs_url = f"gs://hospyn-results/lab_results/{order_id}/{file.filename}"
    from sqlalchemy import text
    await db.execute(
        text("UPDATE lab_orders SET result_url=:url, status='report_ready' WHERE id=:id"),
        {"url": gcs_url, "id": order_id}
    )
    await db.commit()
    return {"status": "success", "result_url": gcs_url}
