# backend/healthcare-core/app/models/support_ticket.py
from datetime import datetime
from typing import Optional
import uuid
from sqlalchemy import String, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id:                   Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    partner_id:           Mapped[uuid.UUID]      = mapped_column(UUID(as_uuid=True), ForeignKey("partners.id", ondelete="CASCADE"), nullable=False)
    ticket_number:        Mapped[str]            = mapped_column(String(50), nullable=False, unique=True)
    category:             Mapped[str]            = mapped_column(String(50), nullable=False)
    subject:              Mapped[str]            = mapped_column(String(500), nullable=False)
    description:          Mapped[str]            = mapped_column(Text, nullable=False)
    status:               Mapped[str]            = mapped_column(String(30), default="open")
    priority:             Mapped[str]            = mapped_column(String(20), default="medium")
    reference_id:         Mapped[Optional[str]]  = mapped_column(String(100), nullable=True)
    reference_type:       Mapped[Optional[str]]  = mapped_column(String(30), nullable=True)
    sla_deadline:         Mapped[datetime]       = mapped_column(DateTime, nullable=False)
    partner_message:      Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    partner_visible_note: Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    internal_notes:       Mapped[Optional[str]]  = mapped_column(Text, nullable=True)
    assigned_to:          Mapped[Optional[str]]  = mapped_column(String(255), nullable=True)
    resolved_at:          Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at:           Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:           Mapped[datetime]       = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
