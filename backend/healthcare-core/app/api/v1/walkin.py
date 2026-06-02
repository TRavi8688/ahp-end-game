# backend/healthcare-core/app/api/v1/walkin.py  (or the Pydantic schema file)
# SEC-11 FIX: Add Indian phone number format validation.

import re
from pydantic import BaseModel, validator, Field
from typing import Optional


class WalkInRequestSchema(BaseModel):
    """
    Pydantic schema for walk-in patient registration.
    SEC-11 FIX: phone field now validates Indian mobile number format.
    """

    name: str = Field(..., min_length=2, max_length=100)
    phone: str = Field(..., description="Indian mobile number (10 digits, starting with 6-9)")
    # ... other existing fields ...

    @validator("phone")
    def validate_indian_phone(cls, v: str) -> str:
        """
        SEC-11 FIX: Validates Indian mobile number format.
        Rules:
          - Exactly 10 digits
          - First digit must be 6, 7, 8, or 9 (valid Indian mobile prefixes)
          - Optional leading +91 or 0 is stripped before validation
        Returns HTTP 422 automatically if validation fails (Pydantic default).
        """
        # Strip optional country code prefix (+91 or 91) or leading 0
        cleaned = re.sub(r"^\+?91|^0", "", v.strip())

        if not re.match(r"^[6-9]\d{9}$", cleaned):
            raise ValueError(
                "Invalid Indian mobile number. "
                "Must be 10 digits starting with 6, 7, 8, or 9. "
                "Example: 9876543210"
            )
        return cleaned
