"""
AI Service — Clinical Summarizer
==================================
PHASE 2 FIX — Replace the hardcoded placeholder string with a real Gemini API call.

The original code at lines 207-209 returned:
  return {"summary": "AI summary placeholder - Gemini integration pending"}

This file shows the exact replacement for that block. The full main.py is unchanged
except for the _generate_ai_summary function and its imports.

HOW TO APPLY:
  1. Open backend/ai-service/app/main.py
  2. Find the _generate_ai_summary function (around line 195-210)
  3. Replace it entirely with the function below
  4. Add 'google-generativeai>=0.7.0' to backend/ai-service/requirements.txt
  5. Set GEMINI_API_KEY in backend/ai-service/.env

MANUAL STEP:
  Get GEMINI_API_KEY from https://aistudio.google.com (free tier, no billing needed)
  Model: gemini-1.5-flash (fast, cheap, sufficient for clinical summaries)
"""

# ── Replacement for _generate_ai_summary in backend/ai-service/app/main.py ───
#
# Replace this old function:
#
#   async def _generate_ai_summary(scrubbed_note: str, context: dict) -> dict:
#       # TODO: Integrate Gemini
#       return {"summary": "AI summary placeholder - Gemini integration pending"}
#
# With this complete implementation:

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

# ── Settings addition (add these to ai-service/app/config/settings.py) ────────
GEMINI_API_KEY_ENV = "GEMINI_API_KEY"          # Set this in .env
GEMINI_MODEL = "gemini-1.5-flash"              # Fast, cost-effective for clinical notes
GEMINI_MAX_OUTPUT_TOKENS = 600                 # Summary should be concise
ENABLE_TRIAGE_ENGINE_ENV = "ENABLE_TRIAGE_ENGINE"  # Default False until clinically validated


# ── Drop-in replacement function ─────────────────────────────────────────────

async def _generate_ai_summary(scrubbed_note: str, context: dict) -> dict:
    """
    Generate a clinical summary using Google Gemini.

    PRIVACY: Only `scrubbed_note` is sent to Gemini — it has PHI removed.
    The original clinical_note with patient identifiers is NEVER sent to any
    external API. This is enforced by the PHI scrubbing step in the calling code.

    Args:
        scrubbed_note: Clinical note with all PHI (name, DOB, MRN, address) removed.
        context: Dict with specialty, visit_type, complaint — no PHI allowed here either.

    Returns:
        dict with keys: summary, key_findings, follow_up_suggested, confidence
    """
    gemini_api_key = os.getenv(GEMINI_API_KEY_ENV)

    if not gemini_api_key:
        logger.error(
            "GEMINI_API_KEY is not set. AI clinical summarizer is unavailable. "
            "Get a free key from https://aistudio.google.com and set GEMINI_API_KEY in .env"
        )
        return {
            "summary": None,
            "error": "AI summarizer is not configured. Set GEMINI_API_KEY in the ai-service environment.",
            "available": False,
        }

    try:
        import google.generativeai as genai

        genai.configure(api_key=gemini_api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)

        # Build a clinical prompt that is specialty-aware
        specialty = context.get("specialty", "General Medicine")
        visit_type = context.get("visit_type", "OPD")
        chief_complaint = context.get("chief_complaint", "Not specified")

        prompt = f"""You are a clinical documentation assistant. Generate a structured summary of the following clinical note.

Specialty: {specialty}
Visit Type: {visit_type}
Chief Complaint: {chief_complaint}

Clinical Note (PHI-scrubbed):
{scrubbed_note}

Provide a JSON response with exactly these keys:
- "summary": A 2-3 sentence clinical summary suitable for the patient record (plain English, no medical jargon)
- "key_findings": A list of 3-5 key clinical findings as short strings
- "follow_up_suggested": Boolean — whether follow-up is clinically indicated based on the note
- "follow_up_note": If follow_up_suggested is true, a one-sentence recommendation (else null)

Respond with ONLY the JSON object, no markdown, no preamble."""

        response = await model.generate_content_async(
            prompt,
            generation_config=genai.types.GenerationConfig(
                max_output_tokens=GEMINI_MAX_OUTPUT_TOKENS,
                temperature=0.2,  # Low temperature for clinical content — deterministic
            ),
        )

        raw_text = response.text.strip()

        # Parse JSON response
        import json
        # Strip markdown code fences if present
        if raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1]
            if raw_text.startswith("json"):
                raw_text = raw_text[4:]
            raw_text = raw_text.strip()

        parsed = json.loads(raw_text)

        # Validate expected keys
        required_keys = {"summary", "key_findings", "follow_up_suggested"}
        if not required_keys.issubset(parsed.keys()):
            raise ValueError(f"Gemini response missing required keys: {required_keys - parsed.keys()}")

        logger.info(f"AI summary generated successfully for {visit_type} visit")
        return {
            **parsed,
            "model": GEMINI_MODEL,
            "available": True,
            "error": None,
        }

    except ImportError:
        logger.error(
            "google-generativeai package not installed. "
            "Add 'google-generativeai>=0.7.0' to backend/ai-service/requirements.txt and pip install it."
        )
        return {
            "summary": None,
            "error": "google-generativeai not installed. Add it to ai-service/requirements.txt.",
            "available": False,
        }

    except Exception as e:
        logger.error(f"Gemini API call failed: {type(e).__name__}: {e}")
        return {
            "summary": None,
            "error": f"AI summarizer temporarily unavailable: {type(e).__name__}",
            "available": False,
        }


# ── Triage Engine guard (add this at the top of the triage endpoint) ──────────
#
# Add to the POST /api/v1/ai/triage endpoint handler:
#
#   ENABLE_TRIAGE = os.getenv("ENABLE_TRIAGE_ENGINE", "false").lower() == "true"
#   if not ENABLE_TRIAGE:
#       raise HTTPException(
#           status_code=503,
#           detail={
#               "error": "TRIAGE_ENGINE_DISABLED",
#               "message": "Triage engine is pending clinical validation by a registered physician.",
#               "contact": "Contact your hospital administrator to request clinical sign-off."
#           }
#       )
#
# Set ENABLE_TRIAGE_ENGINE=false in ai-service/.env (default)
# Only set to true after a registered doctor reviews every threshold value.
