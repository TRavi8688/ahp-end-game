import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Organization(Base):
    """Top-level tenant entity representing an entire healthcare network or corporate entity."""
    __tablename__ = "organizations"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, index=True)
    billing_email = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    hospital_groups = relationship("HospitalGroup", back_populates="organization", cascade="all, delete-orphan")


class HospitalGroup(Base):
    """A logical grouping of hospitals within an organization (e.g., 'North Region Hospitals')."""
    __tablename__ = "hospital_groups"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    organization = relationship("Organization", back_populates="hospital_groups")
    branches = relationship("Branch", back_populates="hospital_group", cascade="all, delete-orphan")


class Branch(Base):
    """A physical hospital branch/location."""
    __tablename__ = "branches"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hospital_group_id = Column(UUID(as_uuid=True), ForeignKey("hospital_groups.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    location = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    hospital_group = relationship("HospitalGroup", back_populates="branches")
    departments = relationship("Department", back_populates="branch", cascade="all, delete-orphan")


class Department(Base):
    """A department within a physical branch (e.g., 'Cardiology', 'ICU')."""
    __tablename__ = "departments"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id = Column(UUID(as_uuid=True), ForeignKey("branches.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    branch = relationship("Branch", back_populates="departments")
