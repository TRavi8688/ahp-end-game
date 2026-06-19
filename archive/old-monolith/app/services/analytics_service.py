from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.models import Payment, PaymentStatus, PatientVisit, Bed, BedStatus, DailyHospitalMetrics
from app.core.logging import logger
import uuid
from datetime import datetime, date

class ExecutiveAnalyticsService:
    """
    EXECUTIVE INTELLIGENCE ENGINE (Phase 4.1).
    Routes heavy analytical queries to the Read Replica.
    Provides the CEO with the 'Single Source of Truth' for hospital health.
    """
    def __init__(self, read_db: AsyncSession):
        self.db = read_db

    async def generate_daily_snapshot(self, hospital_id: uuid.UUID):
        """
        Calculates and caches the daily performance metrics for a hospital.
        """
        today_start = datetime.combine(date.today(), datetime.min.time())
        
        # 1. Financial Metric: Total Revenue (Paid Today)
        rev_stmt = select(func.sum(Payment.amount)).where(
            Payment.hospital_id == hospital_id,
            Payment.status == PaymentStatus.PAID,
            Payment.created_at >= today_start
        )
        total_revenue = (await self.db.execute(rev_stmt)).scalar() or 0.0

        # 2. Operational Metric: Bed Occupancy Rate
        bed_stmt = select(
            func.count(Bed.id).label("total"),
            func.sum(func.case((Bed.status == BedStatus.OCCUPIED, 1), else_=0)).label("occupied")
        ).where(Bed.hospital_id == hospital_id)
        bed_data = (await self.db.execute(bed_stmt)).one()
        occupancy_rate = (bed_data.occupied / bed_data.total * 100) if bed_data.total > 0 else 0.0

        # 3. Operational Metric: Patient Volume
        patient_stmt = select(func.count(PatientVisit.id)).where(
            PatientVisit.hospital_id == hospital_id,
            PatientVisit.created_at >= today_start
        )
        patient_count = (await self.db.execute(patient_stmt)).scalar() or 0

        # 4. Snapshot the data (Move to Write DB for persistence)
        # Note: In a real architecture, we would emit an event or return this 
        # to a background task that writes to the primary DB.
        
        metrics = {
            "hospital_id": hospital_id,
            "date": today_start,
            "total_revenue": total_revenue,
            "bed_occupancy_rate": occupancy_rate,
            "total_patients_seen": patient_count
        }

        logger.info(f"EXECUTIVE_SNAPSHOT_GENERATED: Hospital {hospital_id} | Revenue: {total_revenue}")
        return metrics
