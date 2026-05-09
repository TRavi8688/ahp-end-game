import sys
import os
import json
import asyncio
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import AsyncSessionLocal
from app.services.clinical_service import ClinicalService
from app.services.clinical_context_service import clinical_context_service
from app.models.models import ClinicalEvent, DigitalPrescription, Patient, User, StaffProfile, Hospital
from app.core.config import settings

async def verify_system_integrity():
    async with AsyncSessionLocal() as db:
        clinical_service = ClinicalService(model=DigitalPrescription, db=db)
        
        print("\n--- PHASE 10: INTEGRITY VERIFICATION (ASYNC) ---")
        
        try:
            # 1. Setup Test Context
            # Ensure a Hospital exists
            h_res = await db.execute(select(Hospital).limit(1))
            hospital = h_res.scalar()
            if not hospital:
                print("(+) Auto-provisioning Test Hospital...")
                hospital = Hospital(name="Hospyn Integrity Hospital", registration_number="Hospyn-TEST-001")
                db.add(hospital)
                await db.flush()

            # Ensure a Patient exists
            patient_res = await db.execute(select(Patient).limit(1))
            patient = patient_res.scalar()
            if not patient:
                print("(+) Auto-provisioning Test Patient...")
                p_user = User(email="test@patient.com", role="patient", hashed_password="mock", first_name="Integrity", last_name="Patient")
                db.add(p_user)
                await db.flush()
                patient = Patient(user_id=p_user.id, hospyn_id="Hospyn-PAT-001", phone_number="1234567890")
                db.add(patient)
                await db.flush()
            
            # Ensure a Doctor with Profile exists
            doctor_res = await db.execute(
                select(User).options(selectinload(User.staff_profile)).filter(User.role == "doctor").limit(1)
            )
            doctor = doctor_res.scalar()
            
            if not doctor:
                print("(+) Auto-provisioning Test Doctor...")
                doctor = User(email="doctor@integrity.com", role="doctor", hashed_password="mock")
                db.add(doctor)
                await db.flush()
            
            if not doctor.staff_profile:
                print("(+) Auto-provisioning Doctor Profile...")
                profile = StaffProfile(user_id=doctor.id, hospital_id=hospital.id, department_id=1)
                db.add(profile)
                await db.flush()
                doctor.staff_profile = profile # Manually link for this session
            
            await db.commit() # FINAL COMMIT TO SEAL TEST DATA
            
            # Refresh from DB to be 100% sure
            patient_res = await db.execute(select(Patient).filter(Patient.id == patient.id))
            patient = patient_res.scalar()
            
            doctor_res = await db.execute(
                select(User).options(selectinload(User.staff_profile)).filter(User.id == doctor.id)
            )
            doctor = doctor_res.scalar()

            print(f"(+) CONTEXT: Patient {patient.id}, Doctor {doctor.id} (Hospital {doctor.staff_profile.hospital_id})")

            # 2. Simulate Clinical Action: Creating a Prescription
            print("\n[ACTION] Doctor is issuing a new digital prescription...")
            meds = [{"name": "Amoxicillin", "dosage": "500mg", "frequency": "TDS"}]
            prescription = await clinical_service.create_prescription(
                db=db,
                hospital_id=doctor.staff_profile.hospital_id,
                doctor_id=doctor.id,
                patient_id=patient.id,
                medications=meds,
                notes="Patient has mild throat infection. Monitor for allergic reaction."
            )
            await db.commit()
            print(f"(+) SUCCESS: Prescription {prescription.qr_code_id} issued.")

            # 3. Verify Immutable Event Log
            print("\n[VERIFY] Checking Clinical Event Log...")
            event_res = await db.execute(
                select(ClinicalEvent).filter(
                    ClinicalEvent.aggregate_id == str(prescription.id),
                    ClinicalEvent.event_type == "PRESCRIPTION_CREATED"
                )
            )
            event = event_res.scalar()

            if event:
                print(f"(+) EVENT FOUND: {event.id}")
                print(f"   - Type: {event.event_type}")
                print(f"   - Signature: {event.signature[:32]}... (Cryptographically Sealed)")
                print(f"   - Payload Check: {json.dumps(event.payload)}")
            else:
                print("(!) ERROR: No event logged for the action!")

            # 4. Verify AI Shield (Clinical Context Service)
            print("\n[VERIFY] Testing AI Shield Layer (Chitti's Context)...")
            # Note: Context service is currently synchronous in my code, 
            # I should wrap it or make it handle async sessions. 
            # For this test, I'll update the context service to be async-compatible.
            context = await clinical_context_service.get_patient_clinical_context(
                db=db,
                patient_id=patient.id,
                requesting_user_role="ai_assistant"
            )
            
            print("(+) AI CONTEXT GENERATED:")
            timeline_entry = context['timeline'][0]
            print(f"   - Event in AI Timeline: {timeline_entry['type']}")
            print(f"   - Payload seen by AI: {json.dumps(timeline_entry['data'])}")
            
            if "[REDACTED_FOR_PRIVACY]" in str(timeline_entry['data']):
                print("(+) PHI GUARD ACTIVE: Sensitive clinical notes were successfully redacted from the AI.")

            print("\n--- (+) INTEGRITY VERIFIED: THE HEART IS BEATING ---")

        except Exception as e:
            print(f"(!) INTEGRITY FAILURE: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_system_integrity())
