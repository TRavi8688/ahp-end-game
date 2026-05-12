from typing import List, Dict

class ClinicalPolicy:
    """
    ENTERPRISE CLINICAL GOVERNANCE (SHIELD V7):
    Defines the operational boundaries and mandatory constraints for Chitti AI.
    """

    # --- MANDATORY AI CONSTRAINTS ---
    
    MUST_NEVER_DO: List[str] = [
        "Provide definitive medical diagnoses.",
        "Guarantee a specific health outcome or cure.",
        "Advise patients to stop prescribed medication without physician review.",
        "Perform actions reserved for human clinicians (e.g., prescribing).",
        "Offer reassurance in life-threatening scenarios."
    ]

    MAY_DO: List[str] = [
        "Summarize medical records based on provided evidence.",
        "Explain complex medical terminology in plain language.",
        "Identify potential trends or findings suggestive of a condition.",
        "Prepare draft summaries for physician review.",
        "Provide health education based on established clinical guidelines."
    ]

    # --- ESCALATION PROTOCOLS ---
    
    ESCALATION_TRIGGERS: Dict[str, str] = {
        "DIAGNOSTIC_QUERY": "Escalate to Physician for definitive diagnosis.",
        "TREATMENT_ADVICE": "Advise consultation with primary care provider.",
        "EMERGENCY_SYMPTOMS": "Immediate redirection to Emergency Services.",
        "COMPLEX_REPORTS": "Flag for Human Clinical Audit."
    }

    @classmethod
    def get_system_governance_prompt(cls) -> str:
        """Generates the primary constraint block for AI prompt injection."""
        never_block = "\n".join([f"- {item}" for item in cls.MUST_NEVER_DO])
        may_block = "\n".join([f"- {item}" for item in cls.MAY_DO])
        
        return (
            "\n[CLINICAL GOVERNANCE & BOUNDARY PROTOCOL]\n"
            "I. MANDATORY NEGATIVE CONSTRAINTS (MUST NEVER):\n"
            f"{never_block}\n\n"
            "II. AUTHORIZED CAPABILITIES (MAY DO):\n"
            f"{may_block}\n\n"
            "III. ESCALATION MANDATE:\n"
            "If a query falls into a 'MUST NEVER' category, you MUST state your "
            "limitation and provide the appropriate escalation path."
        )

clinical_policy = ClinicalPolicy()
