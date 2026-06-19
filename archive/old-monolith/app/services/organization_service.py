import random
import string
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Hospital
import uuid

class OrganizationService:
    """
    Manages the lifecycle of Hospitals, Pharmacies, and Labs.
    """
    
    @staticmethod
    def _generate_short_code() -> str:
        """
        Generates a 6-character human-readable code (e.g., HSP-92X).
        """
        chars = string.ascii_uppercase + string.digits
        code = ''.join(random.choices(chars, k=6))
        return f"HSP-{code}"

    @classmethod
    async def create_organization(
        cls, 
        db: AsyncSession, 
        name: str, 
        reg_number: str,
        org_type: str = "hospital"
    ) -> Hospital:
        """
        Creates a new organization with a unique UUID and a human-readable short code.
        """
        hospyn_id = str(uuid.uuid4())
        short_code = cls._generate_short_code()
        
        # In a production system, we would loop until we find a truly unique short_code
        
        org = Hospital(
            name=name,
            registration_number=reg_number,
            hospyn_id=hospyn_id,
            short_code=short_code,
            org_type=org_type
        )
        
        db.add(org)
        await db.commit()
        return org
