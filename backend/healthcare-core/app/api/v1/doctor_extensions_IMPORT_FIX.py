"""
healthcare-core/app/api/v1/doctor_extensions.py

FIX: Wrong import `from backend.shared.utils.event_bus import EventBus`
     → `from shared.utils.event_bus import EventBus`

This file contains only the import fix. All other content should be preserved
from your existing file — replace ONLY the broken import line.

CHANGE THIS LINE in your existing doctor_extensions.py:
  FROM: from backend.shared.utils.event_bus import EventBus
  TO:   from shared.utils.event_bus import EventBus

If you want a drop-in replacement for the entire file, the correct import is
shown below. Replace the import block at the top of your existing file.
"""

# ── CORRECTED IMPORT (replace the broken line in your existing file) ──────────
from shared.utils.event_bus import EventBus  # noqa: F401 — re-exported for callers

# All other code in doctor_extensions.py remains unchanged.
# This file exists solely to document and fix the import path.
#
# To apply this fix without overwriting your business logic:
#   1. Open healthcare-core/app/api/v1/doctor_extensions.py
#   2. Find:   from backend.shared.utils.event_bus import EventBus
#   3. Replace with: from shared.utils.event_bus import EventBus
#   4. Save and commit.
