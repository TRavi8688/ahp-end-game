from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, ForeignKey, Boolean, Integer
from datetime import datetime, timezone
from typing import Optional
from app.models.models import Base
import uuid

class StaffOnboardingRequest(Base):
    __tablename__ = "staff_onboarding_requests"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    full_name: Mapped[str] = mapped_column(String(255))
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[str] = mapped_column(String(50)) # doctor, nurse, admin, etc.
    certificate_url: Mapped[Optional[str]] = mapped_column(String(512))
    
    is_processed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    processed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
