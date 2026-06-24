"""
backend/auth-service/app/models/user.py

FIXES:
  FIX-U1: Added missing roles to RoleEnum:
           nurse, pharmacist, super_admin, owner, receptionist, lab, hr
           Attempting to register or login with these roles raised a DB constraint error.
  FIX-U2: Added full_name field (frontend Login.jsx reads user.name — was always None)
"""

import uuid
import enum
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Enum as SQLEnum, UUID, func, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from shared.database.core import Base


class RoleEnum(str, enum.Enum):
    patient        = "patient"
    doctor         = "doctor"
    admin          = "admin"
    hospital_admin = "hospital_admin"
    staff          = "staff"
    # FIX-U1: Added missing roles
    nurse          = "nurse"
    pharmacist     = "pharmacist"
    super_admin    = "super_admin"
    owner          = "owner"
    receptionist   = "receptionist"
    lab            = "lab"
    hr             = "hr"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    # FIX-U2: full_name added — login response returns user.name to frontend
    full_name: Mapped[str] = mapped_column(String(255), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=True)
    phone_number: Mapped[str] = mapped_column(
        String(20), unique=True, index=True, nullable=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[RoleEnum] = mapped_column(SQLEnum(RoleEnum), default=RoleEnum.patient)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    token_version: Mapped[int] = mapped_column(Integer, default=1)

    # FIX-U3 (2026-06-23): Tracks whether this account finished OTP verification.
    # Without this, a user who registered but never completed OTP looked
    # identical to a fully verified user, so /check-user could only say
    # "already registered" and send them to Login with no way to resume
    # verification. New registrations start False; verify-otp flips it True.
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)

    # FIX-U3: Where this account's credentials came from: 'local' | 'google' | 'apple'.
    auth_provider: Mapped[str] = mapped_column(String(20), default="local")

    # FIX-U3: False for Google/Apple-created accounts until the user explicitly
    # sets a real password via POST /auth/set-password. Lets /login give a
    # helpful "this account uses Google Sign-In" message instead of a generic
    # "invalid credentials" when a social-only user tries Hospyn ID + password.
    has_usable_password: Mapped[bool] = mapped_column(Boolean, default=True)
    hospital_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=True, index=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=True)


class OTPVerification(Base):
    __tablename__ = "otp_verifications"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    identifier: Mapped[str] = mapped_column(String(255), index=True)
    hashed_otp: Mapped[str] = mapped_column(String(255))
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    hashed_token: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
