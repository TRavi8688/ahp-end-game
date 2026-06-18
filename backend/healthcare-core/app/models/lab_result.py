"""
Lab Result Model

Stores laboratory test results linked to patients.
Retained under NABL accreditation requirements (5-year minimum).
"""

import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, UUID, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LabResult(Base):
    __tablename__ = "lab_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("patients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    patient_name: Mapped[str] = mapped_column(String(200), nullable=True)
    test_name: Mapped[str] = mapped_column(String(255), nullable=False)
    result_value: Mapped[str] = mapped_column(String(255), nullable=True)
    unit: Mapped[str] = mapped_column(String(50), nullable=True)
    reference_range: Mapped[str] = mapped_column(String(100), nullable=True)
    notes: Mapped[str] = mapped_column(Text, nullable=True)
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<LabResult id={self.id} test={self.test_name}>"
