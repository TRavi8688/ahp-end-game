import uuid
import secrets
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import User, Patient, RoleEnum
from app.core.security import get_password_hash
from app.schemas.patient import PatientCreate

class PatientService:
    @staticmethod
    async def create_patient(db: AsyncSession, hospital_id: uuid.UUID, patient_data: PatientCreate) -> Patient:
        # Check if user with phone number exists
        stmt = select(User).where(User.email == patient_data.phone_number)
        res = await db.execute(stmt)
        user = res.scalar_one_or_none()

        if not user:
            # Create the global user
            user = User(
                email=patient_data.phone_number, # phone_number mapped to email col
                hashed_password=get_password_hash(secrets.token_urlsafe(16)),
                role=RoleEnum.patient,
                first_name=patient_data.first_name,
                last_name=patient_data.last_name,
                hospyn_id=f"Hospyn-{secrets.token_hex(4).upper()}" # Generate a unique Hospyn ID
            )
            db.add(user)
            await db.flush() # get user id
        
        # Check if patient record exists for this hospital
        stmt = select(Patient).where(Patient.user_id == user.id, Patient.hospital_id == hospital_id)
        res = await db.execute(stmt)
        patient = res.scalar_one_or_none()
        
        if not patient:
            # Create Tenant-Scoped Patient Record
            patient = Patient(
                user_id=user.id,
                hospital_id=hospital_id,
                hospyn_id=user.hospyn_id,
                phone_number=patient_data.phone_number,
                date_of_birth=patient_data.date_of_birth,
                gender=patient_data.gender,
                blood_group=patient_data.blood_group
            )
            db.add(patient)
            await db.commit()
            await db.refresh(patient)
            
        return patient

    @staticmethod
    async def search_patients(db: AsyncSession, hospital_id: uuid.UUID, search_term: str):
        # We need to search by hospyn_id, phone, or name within the hospital's tenant scope
        stmt = select(Patient, User).join(User, Patient.user_id == User.id).where(Patient.hospital_id == hospital_id)
        
        if search_term:
            stmt = stmt.where(
                (User.first_name.ilike(f"%{search_term}%")) | 
                (User.last_name.ilike(f"%{search_term}%")) | 
                (Patient.phone_number.ilike(f"%{search_term}%")) |
                (Patient.hospyn_id.ilike(f"%{search_term}%"))
            )
            
        stmt = stmt.limit(20)
        res = await db.execute(stmt)
        rows = res.all()
        
        results = []
        for patient, user in rows:
            results.append({
                "id": str(patient.id),
                "user_id": str(user.id),
                "hospyn_id": patient.hospyn_id,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone_number": patient.phone_number,
                "date_of_birth": patient.date_of_birth,
                "gender": patient.gender,
                "blood_group": patient.blood_group,
                "created_at": patient.created_at.isoformat()
            })
            
        return results
