from enum import Enum
from typing import Dict, Any
from pydantic import BaseModel

class SubscriptionTier(str, Enum):
    STARTER = "starter"           # Small clinics, private shops
    MULTI_SPECIALTY = "multi"     # Medium hospitals
    ENTERPRISE = "enterprise"     # Large networks, government

class TierLimits(BaseModel):
    max_doctors: int
    max_patients: int
    storage_gb: int
    ai_features_enabled: bool

TIER_CONFIGS = {
    SubscriptionTier.STARTER: TierLimits(
        max_doctors=5,
        max_patients=1000,
        storage_gb=10,
        ai_features_enabled=False
    ),
    SubscriptionTier.MULTI_SPECIALTY: TierLimits(
        max_doctors=50,
        max_patients=50000,
        storage_gb=500,
        ai_features_enabled=True
    ),
    SubscriptionTier.ENTERPRISE: TierLimits(
        max_doctors=9999,
        max_patients=9999999,
        storage_gb=10000,
        ai_features_enabled=True
    )
}

class SubscriptionService:
    """
    Hospyn Monetization & Quota Engine
    """
    
    @staticmethod
    def get_tier_limits(tier: SubscriptionTier) -> TierLimits:
        return TIER_CONFIGS.get(tier, TIER_CONFIGS[SubscriptionTier.STARTER])

    @staticmethod
    async def create_billing_session(hospyn_id: str, tier: SubscriptionTier):
        """
        In production: Integrates with Stripe Billing/Checkout.
        """
        # Placeholder for Stripe Checkout URL
        return {
            "checkout_url": f"https://checkout.hospyn.com/pay?tenant={hospyn_id}&tier={tier}",
            "status": "pending_payment"
        }
