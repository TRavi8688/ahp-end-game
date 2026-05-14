from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Patient, User, Condition, Medication
from app.schemas import schemas
from app.core import security
from app.services.base import BaseService
import uuid
from typing import Optional, List

class PatientService(BaseService[Patient]):
    def __init__(self, db: AsyncSession):
        super().__init__(Patient, db)

    async def get_by_hospyn_id(self, hospyn_id: str) -> Optional[Patient]:
        stmt = select(Patient).where(Patient.hospyn_id == hospyn_id.upper())
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def setup_profile(self, data: schemas.PatientCreate, user_id: uuid.UUID) -> Patient:
        """Upsert onboarding logic for patients."""
        # For local forensic dev, we use a central hospital ID
        central_hospital_id = uuid.UUID("f0f0f0f0-f0f0-4040-b0b0-a0a0a0a0a0a0")
        
        patient = await self.get_by_user_id(user_id)
        
        if not patient:
            patient = Patient(
                user_id=user_id,
                hospyn_id=f"Hospyn-{uuid.uuid4().hex[:8].upper()}",
                phone_number=data.phone_number,
                language_code=data.language_code,
                hospital_id=central_hospital_id
            )
            self.db.add(patient)
            await self.db.flush()


        
        patient.date_of_birth = data.date_of_birth
        patient.gender = data.gender
        patient.blood_group = data.blood_group
        
        # Sync conditions
        for c_name in data.conditions:
            cond = Condition(
                patient_id=patient.id, 
                name=c_name, 
                added_by="patient",
                hospital_id=central_hospital_id
            )
            self.db.add(cond)
            
        # Sync medications
        for m_name in data.medications:
            med = Medication(
                patient_id=patient.id, 
                generic_name=m_name, 
                added_by="patient",
                hospital_id=central_hospital_id
            )
            self.db.add(med)

            
        await self.db.flush()
        return patient

    async def get_by_user_id(self, user_id: uuid.UUID) -> Optional[Patient]:
        stmt = select(Patient).where(Patient.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()
