import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime, Enum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum

class TenantType(str, enum.Enum):
    ORGANIZATION = "organization"
    HOSPITAL_GROUP = "hospital_group"
    BRANCH = "branch"
    DEPARTMENT = "department"

class User(Base):
    """Global IAM User Entity"""
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_super_admin = Column(Boolean, default=False)  # Global Super Admin override
    mfa_enabled = Column(Boolean, default=False)
    mfa_secret = Column(String, nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    tenant_roles = relationship("TenantUser", back_populates="user", cascade="all, delete-orphan")


class Role(Base):
    """RBAC Role Definitions (e.g. 'hospital_admin', 'doctor', 'compliance_manager')"""
    __tablename__ = "roles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)
    permissions = Column(JSONB, default=list) # Array of permission strings e.g. ["patient:read", "verification:approve"]
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class TenantUser(Base):
    """Maps a user to a specific tenant (Org, Group, Branch, Dept) with a specific Role."""
    __tablename__ = "tenant_users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role_id = Column(UUID(as_uuid=True), ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    
    # Polymorphic tenant association
    tenant_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    tenant_type = Column(Enum(TenantType), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="tenant_roles")
    role = relationship("Role")
