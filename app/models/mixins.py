"""
Hospyn Enterprise Model Mixins.

Every mixin in this file encodes a strict architectural guarantee.
These are composable building blocks that MUST be inherited by all
domain models to enforce consistency across the entire schema.

Mixin Catalogue:
    - TimestampMixin   : UTC-only created_at / updated_at
    - SoftDeleteMixin  : Logical delete — physical DELETE is BANNED
    - VersionedMixin   : Optimistic locking via version_id
    - TenantScopedMixin: Row-level hospital_id isolation
    - AuditableMixin   : Tracks who last modified a record
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, declared_attr


class TimestampMixin:
    """
    Guarantees every record stores creation and modification times in UTC.
    Timezone conversion happens ONLY at the UI layer — never in the DB.
    """
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class SoftDeleteMixin:
    """
    Enforces logical deletion. Records are NEVER physically removed.
    Healthcare and legal requirements mandate this for all clinical data.
    Always filter with: .filter(Model.deleted_at.is_(None))
    """
    deleted_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None, index=True
    )
    deleted_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, default=None
    )

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class VersionedMixin:
    """
    Implements Optimistic Locking. All writes must include the current
    version_id. If two transactions conflict, the second one receives
    a StaleDataError and must retry.

    SQLAlchemy enforces this via __mapper_args__ = {"version_id_col": version_id}
    which must be declared on the concrete model.
    """
    version_id: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class TenantScopedMixin:
    """
    Enforces multi-tenancy at the row level. Every record that belongs
    to a hospital MUST have a hospital_id. Queries without a hospital_id
    filter in hospital-scoped endpoints are a security violation.
    """
    @declared_attr
    def hospital_id(cls) -> Mapped[int]:
        return mapped_column(
            Integer,
            ForeignKey("hospitals.id", ondelete="RESTRICT"),
            nullable=False,
            index=True,
        )


class AuditableMixin:
    """
    Tracks which user performed the last write operation on a record.
    Works in conjunction with the immutable AuditLog table for full history.
    """
    last_modified_by_id: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True, default=None
    )
