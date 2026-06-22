"""
Phase 6 Fix — Patient Model Patch

ADD TO: backend/healthcare-core/app/models/patient.py

Locate the "# Status" section in the Patient class and add these two columns
directly above or below the `is_active` column:

    # Push Notifications
    push_token: Mapped[str] = mapped_column(String(512), nullable=True)
    push_token_platform: Mapped[str] = mapped_column(String(20), nullable=True)

Full example of how the Status block should look after the patch:

    # Status
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Push Notifications (Phase 6)
    push_token: Mapped[str] = mapped_column(String(512), nullable=True)
    push_token_platform: Mapped[str] = mapped_column(String(20), nullable=True)

No other changes needed in this file.
Then run: alembic upgrade head
"""

# This file is a PATCH INSTRUCTIONS document, not a standalone Python file.
# See the migration file: b7c8d9e0f1a2_add_push_token_to_patients.py
