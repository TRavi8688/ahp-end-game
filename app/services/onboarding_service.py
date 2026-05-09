import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models.onboarding import HospitalInvite
from app.core.security import create_access_token
import uuid

class OnboardingService:
    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode()).hexdigest()

    @classmethod
    async def create_invite(
        cls, 
        db: AsyncSession, 
        hospital_id: uuid.UUID, 
        email: str, 
        hospyn_id: str,
        created_by: uuid.UUID,
        ip_address: Optional[str] = None,
        role: str = "OWNER",
        expires_in_hours: int = 24
    ) -> Tuple[str, str]:
        """
        Generates a raw token and stores its hash.
        Includes audit metadata (created_by, ip_address).
        """
        raw_token = secrets.token_urlsafe(32)
        token_hash = cls._hash_token(raw_token)
        
        expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)
        
        invite = HospitalInvite(
            hospital_id=hospital_id,
            email=email,
            token_hash=token_hash,
            role=role,
            expires_at=expires_at,
            hospyn_id=hospyn_id,
            created_by=created_by,
            ip_address=ip_address
        )
        
        db.add(invite)
        await db.commit()
        
        # In a real system, the URL would point to your frontend onboarding page
        onboarding_url = f"https://hospyn.com/onboarding?token={raw_token}"
        return raw_token, onboarding_url

    @classmethod
    async def verify_invite(cls, db: AsyncSession, raw_token: str) -> Optional[HospitalInvite]:
        """
        Validates a raw token against the stored hash.
        """
        token_hash = cls._hash_token(raw_token)
        
        query = select(HospitalInvite).where(
            HospitalInvite.token_hash == token_hash,
            HospitalInvite.is_used == False,
            HospitalInvite.expires_at > datetime.now(timezone.utc)
        )
        
        result = await db.execute(query)
        invite = result.scalar_one_or_none()
        return invite

    @classmethod
    async def complete_onboarding(cls, db: AsyncSession, invite_id: uuid.UUID):
        """
        Marks an invite as used.
        """
        await db.execute(
            update(HospitalInvite)
            .where(HospitalInvite.id == invite_id)
            .values(is_used=True, used_at=datetime.now(timezone.utc))
        )
        await db.commit()
