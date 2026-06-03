import asyncio
import uuid
import sys
import os
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Add the project root to sys.path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import get_writer_engine
from sqlalchemy.orm import sessionmaker

async_session_maker = sessionmaker(
    get_writer_engine(), class_=AsyncSession, expire_on_commit=False
)
from app.models.models import User, Hospital, StaffProfile, Patient, DigitalPrescription, PartnerPharmacyRequest, PartnerReferralStatusEnum

async def simulate_scan():
    print("Initializing Patient Simulator...")
    async with async_session_maker() as db:
        # 1. Find the Pharmacy Hospital ID
        # We assume the logged-in pharmacy user is 'pharma_owner@hospyn.com'
        stmt = select(User).where(User.email == "pharma_owner@hospyn.com")
        pharma_user = (await db.execute(stmt)).scalar_one_or_none()
        
        if not pharma_user:
            print("ERROR: Could not find pharmacy user. Using generic hospital.")
            stmt = select(Hospital).where(Hospital.name.ilike('%pharma%'))
            hospital = (await db.execute(stmt)).scalars().first()
            if not hospital:
                 print("ERROR: No pharmacy found in DB.")
                 return
            hospital_id = hospital.id
            hospyn_id = hospital.hospyn_id
        else:
            stmt = select(StaffProfile).where(StaffProfile.user_id == pharma_user.id)
            staff = (await db.execute(stmt)).scalar_one_or_none()
            hospital_id = staff.hospital_id
            
            stmt = select(Hospital).where(Hospital.id == hospital_id)
            hospital = (await db.execute(stmt)).scalar_one_or_none()
            hospyn_id = hospital.hospyn_id
            
        print(f"Target Pharmacy Found! ID: {hospyn_id}")
        
        # 2. Find or Create a Dummy Patient
        stmt = select(Patient).limit(1)
        patient = (await db.execute(stmt)).scalars().first()
        
        if not patient:
            print("Creating dummy patient...")
            dummy_user = User(
                email="dummy_patient@hospyn.com",
                hashed_password="...",
                first_name="Jane",
                last_name="Doe",
                role="patient"
            )
            db.add(dummy_user)
            await db.flush()
            patient = Patient(
                user_id=dummy_user.id,
                hospyn_id="HOS-PAT-123",
                phone_number="9999999999"
            )
            db.add(patient)
            await db.flush()
            
        # 3. Create a Digital Prescription in the Patient's Vault
        print("Generating a test prescription...")
        medications = [
            {"name": "Azithromycin 500mg", "dosage": "1 tablet", "frequency": "Once a day", "duration": "5 days"},
            {"name": "Paracetamol 650mg", "dosage": "1 tablet", "frequency": "SOS", "duration": "3 days"}
        ]
        
        from app.models.models import Doctor
        
        # Get a doctor
        stmt = select(Doctor).limit(1)
        doctor = (await db.execute(stmt)).scalars().first()
        doctor_id = doctor.id if doctor else None
        
        prescription = DigitalPrescription(
            patient_id=patient.id,
            hospital_id=hospital_id,
            doctor_id=doctor_id,
            diagnosis="Viral Fever with Mild Throat Infection",
            medications=medications,
            status="pending"
        )
        db.add(prescription)
        await db.flush()
        
        # 4. Simulate the "Send to Pharmacy" action (Patient beams it to the Pharma)
        print(f"Patient scanning QR Code for {hospyn_id}...")
        
        request = PartnerPharmacyRequest(
            prescription_id=prescription.id,
            referring_hospital_id=hospital_id,
            partner_pharmacy_id=hospital_id,
            patient_id=patient.id,
            status=PartnerReferralStatusEnum.pending
        )
        db.add(request)
        await db.commit()
        
        print("✅ SUCCESS! Prescription beamed to the Pharmacy Queue.")
        print("Check the Hospyn Pharma Mobile App to see it appear live!")

if __name__ == "__main__":
    asyncio.run(simulate_scan())
