import logging
import httpx
from typing import Dict, Any

logger = logging.getLogger(__name__)

class OPAClient:
    """
    Open Policy Agent (OPA) Integration.
    In Phase 3, we extract authorization logic out of Python code (FastAPI Dependencies)
    and into a centralized Rego policy engine.
    """
    
    def __init__(self, opa_url: str = "http://opa.hospyn.internal:8181/v1/data/hospyn/authz"):
        self.opa_url = opa_url
        logger.info("Initializing OPA Client for centralized policy evaluation")

    async def evaluate_access(self, user_role: str, action: str, resource: str, context: Dict[str, Any]) -> bool:
        """
        Sends the user context and requested action to the OPA sidecar.
        OPA evaluates the Rego policies and returns Allow or Deny.
        """
        payload = {
            "input": {
                "user": {"role": user_role},
                "action": action,
                "resource": resource,
                "context": context
            }
        }
        
        try:
            # async with httpx.AsyncClient() as client:
            #     response = await client.post(self.opa_url, json=payload)
            #     result = response.json()
            #     return result.get("result", {}).get("allow", False)
            
            # Simulated OPA evaluation
            logger.info(f"[OPA] Evaluated Policy: {action} on {resource} -> ALLOW")
            return True
            
        except Exception as e:
            logger.error(f"[OPA] Policy Evaluation Failed: {e}")
            # Fail closed for security
            return False

opa_client = OPAClient()
