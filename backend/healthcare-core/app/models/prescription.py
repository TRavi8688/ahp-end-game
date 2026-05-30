import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, UUID, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Prescription(Base):
    __tablename__ = "prescriptions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    walkin_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("walkin_requests.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("patients.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("doctors.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationships
    items: Mapped[list["PrescriptionItem"]] = relationship(
        "PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Prescription id={self.id} status={self.status}>"


class PrescriptionItem(Base):
    __tablename__ = "prescription_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    prescription_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("prescriptions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    drug_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[str] = mapped_column(
        String(100), nullable=False
    )  # e.g., "500mg" or "1 tab"
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "1-0-1"
    duration: Mapped[str] = mapped_column(String(100), nullable=False)  # e.g., "5 days"
    instructions: Mapped[str] = mapped_column(
        String(500), nullable=True
    )  # e.g., "After food"

    # Relationship
    prescription: Mapped["Prescription"] = relationship(
        "Prescription", back_populates="items"
    )

    def __repr__(self) -> str:
        return f"<PrescriptionItem id={self.id} drug={self.drug_name}>"
