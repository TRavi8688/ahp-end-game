"""
Triage Service

Business logic for nurse triage operations.
Handles vitals storage, priority escalation, and doctor assignment.
"""

# FIX: E402 — 'import uuid' was placed mid-file after function definitions (line 78).
# All imports must be at the top of the file per PEP 8 / ruff E402.
import uuid
from typing import Optional

from app.models.walkin import WalkInRequest, PriorityLevel

# ---------------------------------------------------------------------------
# Vitals Validation
# ---------------------------------------------------------------------------

VITALS_SCHEMA = {
    "blood_pressure_systolic": int,
    "blood_pressure_diastolic": int,
    "heart_rate": int,
    "temperature": float,
    "spo2": int,
    "respiratory_rate": int,
    "weight_kg": float,
}


def validate_vitals(vitals: dict) -> dict:
    """
    Validate and sanitize vitals data.
    Returns cleaned vitals dict. Raises ValueError for bad data.
    """
    cleaned = {}
    for key, expected_type in VITALS_SCHEMA.items():
        val = vitals.get(key)
        if val is not None:
            try:
                cleaned[key] = expected_type(val)
            except (ValueError, TypeError):
                raise ValueError(f"Invalid value for {key}: {val}")
    return cleaned


# ---------------------------------------------------------------------------
# Priority Escalation
# ---------------------------------------------------------------------------


def assess_priority_from_vitals(vitals: dict) -> Optional[PriorityLevel]:
    """
    Auto-escalate priority based on vitals readings.
    Returns a PriorityLevel if escalation is needed, else None.

    Thresholds based on standard clinical emergency criteria:
    - SpO2 < 90% → EMERGENCY
    - Heart Rate > 150 or < 40 → EMERGENCY
    - Systolic BP > 180 or < 80 → URGENT
    - Temperature > 104°F → URGENT
    """
    spo2 = vitals.get("spo2")
    hr = vitals.get("heart_rate")
    bp_sys = vitals.get("blood_pressure_systolic")
    temp = vitals.get("temperature")

    if spo2 is not None and spo2 < 90:
        return PriorityLevel.emergency
    if hr is not None and (hr > 150 or hr < 40):
        return PriorityLevel.emergency

    if bp_sys is not None and (bp_sys > 180 or bp_sys < 80):
        return PriorityLevel.urgent
    if temp is not None and temp > 104.0:
        return PriorityLevel.urgent

    return None


def apply_triage_data(
    walkin: WalkInRequest,
    vitals: dict,
    triage_notes: str,
    nurse_id: str | uuid.UUID,
) -> WalkInRequest:
    """
    Apply triage data to a walk-in request.
    Auto-escalates priority if vitals are critical.
    """
    cleaned_vitals = validate_vitals(vitals)
    walkin.triage_vitals_json = cleaned_vitals
    walkin.triage_notes = triage_notes
    if nurse_id:
        if isinstance(nurse_id, str):
            walkin.assigned_nurse_id = uuid.UUID(nurse_id)
        else:
            walkin.assigned_nurse_id = nurse_id
    else:
        walkin.assigned_nurse_id = None

    # Auto-escalate priority if vitals warrant it
    escalation = assess_priority_from_vitals(cleaned_vitals)
    if escalation is not None:
        # Only escalate UP, never down
        priority_order = [
            PriorityLevel.low,
            PriorityLevel.normal,
            PriorityLevel.urgent,
            PriorityLevel.emergency,
        ]
        current_idx = priority_order.index(walkin.priority_level)
        new_idx = priority_order.index(escalation)
        if new_idx > current_idx:
            walkin.priority_level = escalation

    return walkin
