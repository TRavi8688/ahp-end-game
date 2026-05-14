from sqlalchemy.ext.asyncio import AsyncSession
from app.models.models import PharmacyStock, StockLedger, StockMovementType, PrescriptionItem
from sqlalchemy import select, update
from app.core.logging import logger
import uuid

class PharmacyService:
    """
    ENTERPRISE PHARMACY ENGINE (Phase 2.3).
    Ensures zero-leakage inventory management and atomic dispensing.
    """
    def __init__(self, db: AsyncSession):
        self.db = db

    async def dispense_medication(self, item_id: uuid.UUID, quantity: int, actor_id: uuid.UUID):
        """
        Atomsically dispenses medication and updates the ledger.
        """
        # 1. Fetch Item and Stock (with lock)
        item = await self.db.get(PrescriptionItem, item_id)
        if not item or not item.medication_id:
            raise ValueError("INVALID_PRESCRIPTION_ITEM")

        # 2. SELECT FOR UPDATE to prevent race conditions (Over-Dispensing)
        stmt = select(PharmacyStock).where(PharmacyStock.id == item.medication_id).with_for_update()
        result = await self.db.execute(stmt)
        stock = result.scalar_one_or_none()

        if not stock:
            raise ValueError("STOCK_NOT_FOUND")

        if stock.quantity < quantity:
            logger.warning(f"STOCK_OUT: {stock.medication_name} | Required: {quantity}, Available: {stock.quantity}")
            item.status = "out_of_stock"
            await self.db.commit()
            raise ValueError("INSUFFICIENT_STOCK")

        # 3. DEDUCT STOCK
        old_balance = stock.quantity
        stock.quantity -= quantity
        new_balance = stock.quantity
        
        # 4. CREATE IMMUTABLE LEDGER ENTRY
        ledger = StockLedger(
            stock_id=stock.id,
            hospital_id=stock.hospital_id,
            movement_type=StockMovementType.OUTWARD,
            quantity=-quantity,
            balance_after=new_balance,
            reference_type="PRESCRIPTION",
            reference_id=str(item.prescription_id),
            actor_id=actor_id
        )
        self.db.add(ledger)

        # 5. UPDATE ITEM STATUS
        item.status = "dispensed"

        # 6. TRIGGER AUTOMATED PROCUREMENT (If needed)
        if new_balance <= stock.min_stock_level:
            logger.info(f"LOW_STOCK_ALERT: {stock.medication_name} reached threshold.")
            # Logic: Stage a Purchase Order for this item if one doesn't exist
            # ... (Procurement logic omitted)

        await self.db.commit()
        logger.info(f"DISPENSED: {quantity} {stock.unit} of {stock.medication_name}")
        return True
