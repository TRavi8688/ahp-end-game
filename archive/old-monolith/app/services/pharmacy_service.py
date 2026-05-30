import uuid
import logging
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.models import PharmacyStock, InventoryTransaction, InventoryTransactionType

logger = logging.getLogger(__name__)

class PharmacyService:
    @staticmethod
    async def deduct_stock(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        stock_id: uuid.UUID,
        quantity: int,
        reference_id: Optional[uuid.UUID] = None,
        staff_id: Optional[uuid.UUID] = None
    ) -> bool:
        """
        ATOMIC STOCK DEDUCTION:
        Subtracts inventory and records the transaction ledger.
        """
        stmt = select(PharmacyStock).where(
            PharmacyStock.id == stock_id, 
            PharmacyStock.hospital_id == hospital_id
        ).with_for_update() # ROW-LEVEL LOCK FOR CONCURRENCY
        
        result = await db.execute(stmt)
        item = result.scalar_one_or_none()
        
        if not item:
            raise ValueError(f"Medication {stock_id} not found in inventory.")
            
        if item.quantity < quantity:
            raise ValueError(f"Insufficient stock for {item.medication_name}. Requested: {quantity}, Available: {item.quantity}")

        # 1. Update Stock
        item.quantity -= quantity
        
        # 2. Record Transaction Ledger
        transaction = InventoryTransaction(
            hospital_id=hospital_id,
            inventory_item_id=stock_id,
            transaction_type=InventoryTransactionType.DISPENSE,
            quantity=-float(quantity),
            reference_id=reference_id,
            notes=f"Dispensed via Invoice {reference_id}" if reference_id else "Direct dispense"
        )
        db.add(transaction)
        
        # 3. Alert on Low Stock
        if item.quantity <= item.min_stock_level:
            logger.warning(f"LOW_STOCK_ALERT: {item.medication_name} | Remaining: {item.quantity}")
            # In a real app, send a notification to the pharmacy manager here
            
        return True

    @staticmethod
    async def add_stock(
        db: AsyncSession,
        hospital_id: uuid.UUID,
        stock_id: uuid.UUID,
        quantity: int,
        staff_id: uuid.UUID
    ) -> bool:
        """
        RESTOCKING Logic.
        """
        stmt = select(PharmacyStock).where(
            PharmacyStock.id == stock_id, 
            PharmacyStock.hospital_id == hospital_id
        ).with_for_update()
        
        result = await db.execute(stmt)
        item = result.scalar_one_or_none()
        
        if not item:
            raise ValueError("Item not found")

        item.quantity += quantity
        
        transaction = InventoryTransaction(
            hospital_id=hospital_id,
            inventory_item_id=stock_id,
            transaction_type=InventoryTransactionType.RESTOCK,
            quantity=float(quantity)
        )
        db.add(transaction)
        return True
