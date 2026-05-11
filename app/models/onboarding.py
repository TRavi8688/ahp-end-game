from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, DateTime, ForeignKey, Boolean
from datetime import datetime, timezone
from typing import Optional
from app.models.models import Base
import uuid

class HospitalInvite(Base):
    __tablename__ = "hospital_invites"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    hospital_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("hospitals.id"), index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    token_hash: Mapped[str] = mapped_column(String(255), unique=True) # Hashed token for verification
    role: Mapped[str] = mapped_column(String(50), default="hospital_admin")
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))
    hospyn_id: Mapped[str] = mapped_column(String(50), index=True) # Tenant isolation link
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True) # IPv6 support
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
