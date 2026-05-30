import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, UUID, ForeignKey, Boolean, func, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from typing import TYPE_CHECKING
from app.core.database import Base

if TYPE_CHECKING:
    from app.models.patient import Patient


class MedicalRecord(Base):
    __tablename__ = "medical_records"
    __table_args__ = (Index("ix_medical_records_patient", "patient_id"),)

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
    )
    record_name: Mapped[str] = mapped_column(String(500), nullable=False)
    hospital_name: Mapped[str] = mapped_column(String(500), nullable=True)
    file_url: Mapped[str] = mapped_column(Text, nullable=True)  # GCS URI
    record_type: Mapped[str] = mapped_column(
        String(50), nullable=True, default="document"
    )  # lab|prescription|scan|document
    ai_summary: Mapped[str] = mapped_column(Text, nullable=True)
    ai_extracted: Mapped[str] = mapped_column(Text, nullable=True)  # JSON string
    raw_text: Mapped[str] = mapped_column(Text, nullable=True)
    patient_summary: Mapped[str] = mapped_column(Text, nullable=True)
    hidden_by_patient: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship
    patient: Mapped["Patient"] = relationship("Patient", backref="medical_records")

    def __repr__(self):
        return f"<MedicalRecord id={self.id} patient_id={self.patient_id}>"
