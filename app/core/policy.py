from enum import Enum
from typing import Dict, Any, List, Optional
from pydantic import BaseModel
from app.core.logging import logger

class Action(str, Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    OVERRIDE = "override"
    EXTRACT_PHI = "extract_phi"
    BYPASS_CONSENT = "bypass_consent"

class ResourceType(str, Enum):
    PATIENT_PHI = "patient_phi"
    CLINICAL_RECORD = "clinical_record"
    AI_EVENT = "ai_event"
    HOSPITAL_CONFIG = "hospital_config"

class Subject(BaseModel):
    user_id: str
    role: str
    hospital_id: str
    is_emergency_mode: bool = False
    groups: List[str] = []

class PolicyEngine:
    """
    ENTERPRISE ABAC (Attribute-Based Access Control) ENGINE.
    Centralizes all complex permission logic for clinical governance.
    """
    
    @staticmethod
    def authorize(
        subject: Subject, 
        action: Action, 
        resource_type: ResourceType, 
        resource_tenant_id: str,
        context: Dict[str, Any] = None
    ) -> bool:
        context = context or {}
        
        # 1. GLOBAL TENANT ISOLATION (Primary Guard)
        if subject.hospital_id != resource_tenant_id:
            logger.critical(f"POLICY_VIOLATION: Cross-tenant access attempt! Subject={subject.user_id}, ResourceTenant={resource_tenant_id}")
            return False

        # 2. EMERGENCY ACCESS (Break-Glass Protocol)
        if subject.is_emergency_mode:
            if action in [Action.READ, Action.WRITE] and resource_type in [ResourceType.PATIENT_PHI, ResourceType.CLINICAL_RECORD]:
                logger.warning(f"POLICY_EMERGENCY_OVERRIDE: Emergency access granted for {subject.user_id}")
                return True

        # 3. ROLE-BASED CONSTRAINTS
        if subject.role == "admin":
            return True # Admin can do anything within their tenant

        if subject.role == "doctor":
            if action == Action.DELETE:
                return False # Doctors cannot delete clinical records
            return True

        if subject.role == "nurse":
            if resource_type == ResourceType.HOSPITAL_CONFIG:
                return False
            return True

        if subject.role == "patient":
            # Patients can only read their own data (This requires resource_owner_id check)
            if action == Action.READ:
                return True
            return False

        # 4. AI ACTION GOVERNANCE
        if action == Action.OVERRIDE and resource_type == ResourceType.AI_EVENT:
            return subject.role in ["doctor", "admin"]

        return False

# Singleton instance
policy_engine = PolicyEngine()
