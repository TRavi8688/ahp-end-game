from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import uuid
from app.models.core import Base

class MedicineDirectory(Base):
    """
    Central database of medicines for type-ahead autocomplete.
    """
    __tablename__ = "medicine_directory"
    
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)  # Brand name or Generic name
    generic_name: Mapped[str] = mapped_column(String(255), nullable=True)
    dosage_form: Mapped[str] = mapped_column(String(100), nullable=True) # Tablet, Syrup, etc.
    common_dosages: Mapped[str] = mapped_column(String(255), nullable=True) # "500mg", "250mg, 500mg"
    manufacturer: Mapped[str] = mapped_column(String(255), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
