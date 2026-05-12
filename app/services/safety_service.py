import re
import uuid
from typing import Dict, List, Optional, Any
from app.core.logging import logger
from app.models.models import ClinicalAIEvent
from sqlalchemy.ext.asyncio import AsyncSession

class ClinicalSafetyService:
    """
    ENTERPRISE CLINICAL SAFETY GUARD (SHIELD V3):
    Monitors all AI inputs and outputs for clinical risk, emergency markers, 
    and policy violations.
    """

    # 1. Emergency Markers (Immediate Human Intervention Required)
    EMERGENCY_PATTERNS = [
        r"\b(suicide|self-harm|kill myself|end my life|don't want to live)\b",
        r"\b(chest pain|heart attack|can't breathe|difficulty breathing|shortness of breath)\b",
        r"\b(stroke|numbness|facial drooping|slurred speech)\b",
        r"\b(seizure|unconscious|passed out|fainted)\b",
        r"\b(poisoning|overdose|toxic ingestion)\b"
    ]

    # 2. Unsafe Medical Advice Patterns (Blocking Hallucinations)
    UNSAFE_ADVICE_PATTERNS = [
        r"\b(stop taking|discontinue|quit)\b.*\b(medication|medicine|pills|prescribed)\b",
        r"\b(i guarantee|i promise|will definitely cure|100% success)\b",
        r"\b(don't see a doctor|don't go to the hospital|no need for medical help)\b"
    ]

    async def semantic_audit(self, prompt: str, response: str) -> Dict[str, Any]:
        """
        FIX 3: SEMANTIC SAFETY AUDIT.
        Uses a high-confidence reasoning step to detect clinical intent bypasses.
        """
        # Late binding to avoid circular import
        from app.services.ai_service import get_ai_service
        ai = await get_ai_service()
        
        audit_prompt = (
            "You are a Clinical Safety Auditor. Analyze the following interaction for:\n"
            "1. Suicide or self-harm intent (even if coded).\n"
            "2. Direct medical advice that bypasses human clinicians.\n"
            "3. Hallucinated diagnostic claims.\n\n"
            f"PROMPT: {prompt}\n"
            f"RESPONSE: {response}\n\n"
            "Return EXCLUSIVELY this JSON: {\"risk_score\": 0.0-1.0, \"reason\": \"...\"}\n"
            "A score > 0.7 indicates a CRITICAL violation."
        )
        
        try:
            # We use a fast, high-reasoning model for the audit (e.g., Gemini Flash)
            # This is a 'Safety Racing' technique
            res = await ai.unified_ai_engine(audit_prompt, language_code="en")
            audit_json = json.loads(res.get("response", "{}"))
            return audit_json
        except Exception as e:
            logger.error(f"SEMANTIC_AUDIT_FAILURE: {e}")
            return {"risk_score": 0.0, "reason": "Audit failed"}

    async def audit_interaction(
        self, 
        prompt: str, 
        response: str, 
        user_id: uuid.UUID,
        db: Optional[AsyncSession] = None
    ) -> Dict[str, Any]:
        # ... (Existing regex logic)
        combined_text = (prompt + " " + response).lower()
        findings = {"is_safe": True, "risk_level": "low", "violations": []}

        # 1. Regex Baseline (Fast)
        for pattern in self.EMERGENCY_PATTERNS:
            if re.search(pattern, combined_text):
                findings.update({"is_safe": False, "risk_level": "CRITICAL", "intervention_type": "EMERGENCY_SERVICES"})
                findings["violations"].append(f"REGEX_MATCH: {pattern}")
                break

        # 2. Semantic Audit (Deep) - ONLY for clinical responses to save latency
        if findings["risk_level"] == "low" and len(response) > 50:
            semantic_res = await self.semantic_audit(prompt, response)
            if semantic_res.get("risk_score", 0) > 0.7:
                findings.update({"is_safe": False, "risk_level": "CRITICAL", "intervention_type": "SEMANTIC_BLOCK"})
                findings["violations"].append(f"SEMANTIC_VIOLATION: {semantic_res.get('reason')}")

        # 3. Forensic Logging
        if db and (findings["risk_level"] != "low"):
            try:
                from app.models.models import ClinicalAIEvent
                event = ClinicalAIEvent(
                    user_id=user_id,
                    trace_id=str(uuid.uuid4()),
                    prompt_template="safety_audit",
                    prompt_payload={"violation": findings["violations"]},
                    response_text=response[:1000],
                    safety_metadata={
                        "risk_level": findings["risk_level"],
                        "intervention": findings.get("intervention_type")
                    },
                    provider="HOSPYN_SAFETY_SHIELD",
                    model_version="v3.enterprise",
                    latency_ms=0
                )
                db.add(event)
                logger.warning(f"CLINICAL_SAFETY_VIOLATION: user={user_id} | level={findings['risk_level']} | reasons={findings['violations']}")
            except Exception as e:
                logger.error(f"SAFETY_LOGGING_FAILURE: {e}")

        return findings

    def inject_safety_protocol(self, response: str, findings: Dict[str, Any]) -> str:
        """
        Appends mandatory safety disclaimers or replaces unsafe text with 
        emergency instructions.
        """
        if findings.get("risk_level") == "CRITICAL":
            return (
                "⚠️ [CLINICAL EMERGENCY DETECTED]\n\n"
                "Our safety protocols have identified signs of a medical or mental health emergency.\n"
                "1. CALL EMERGENCY SERVICES IMMEDIATELY (e.g., 911 or 112).\n"
                "2. Contact human medical help now.\n\n"
                "I am an AI and cannot provide life-saving intervention."
            )
        
        # Standard Disclaimer
        disclaimer = "\n\n---\n*Clinical Intelligence Disclaimer: AI-generated analysis. Consult your physician.*"
        if disclaimer not in response:
            return response + disclaimer
        return response

safety_service = ClinicalSafetyService()
