import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, UUID, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class PaymentTransaction(Base):
    __tablename__ = "payment_transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    walkin_request_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("walkin_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    amount: Mapped[int] = mapped_column(
        Integer, nullable=False
    )  # Stored in paise/cents (integer)
    payment_method: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # cash, card, upi
    status: Mapped[str] = mapped_column(String(20), default="completed", nullable=False)
    transaction_reference: Mapped[str] = mapped_column(
        String(100), nullable=True, index=True
    )
    collected_by: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True  # Staff user_id
    )
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    # Relationship
    walkin_request: Mapped["WalkInRequest"] = relationship(
        "WalkInRequest", backref="transactions"
    )

    def __repr__(self) -> str:
        return f"<PaymentTransaction id={self.id} amount={self.amount} method={self.payment_method}>"
