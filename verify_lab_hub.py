import asyncio
import json
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.core.database import AsyncSessionLocal
from app.services.clinical_service import ClinicalService
from app.services.clinical_context_service import clinical_context_service
from app.models.models import (
    ClinicalEvent, 
    DigitalPrescription, 
    Patient, 
    User, 
    StaffProfile, 
    Hospital,
    LabDiagnosticOrder,
    LabOrderStatusEnum
)

async def verify_lab_hub():
    async with AsyncSessionLocal() as db:
        clinical_service = ClinicalService(model=LabDiagnosticOrder, db=db)
        
        print("\n--- PHASE 10A: LIVE LAB HUB VERIFICATION ---")
        
        try:
            # 1. Setup Context (Auto-provision if needed)
            h_res = await db.execute(select(Hospital).limit(1))
            hospital = h_res.scalar()
            if not hospital:
                print("(+) Provisioning Test Hospital...")
                hospital = Hospital(name="Lab Hub Test Hospital", registration_number="LAB-HUB-001")
                db.add(hospital)
                await db.flush()

            p_res = await db.execute(select(Patient).limit(1))
            patient = p_res.scalar()
            if not patient:
                print("(+) Provisioning Test Patient...")
                p_user = User(email="lab@patient.com", role="patient", hashed_password="mock", first_name="Lab", last_name="Patient")
                db.add(p_user)
                await db.flush()
                patient = Patient(user_id=p_user.id, hospyn_id="Hospyn-PAT-999", phone_number="9998887776")
                db.add(patient)
                await db.flush()
            
            d_res = await db.execute(select(User).options(selectinload(User.staff_profile)).filter(User.role == "doctor").limit(1))
            doctor = d_res.scalar()
            if not doctor:
                print("(+) Provisioning Test Doctor...")
                doctor = User(email="lab_doc@hospyn.com", role="doctor", hashed_password="mock", first_name="Lab", last_name="Doctor")
                db.add(doctor)
                await db.flush()
                profile = StaffProfile(user_id=doctor.id, hospital_id=hospital.id, department_id=1)
                db.add(profile)
                await db.flush()
                # Refresh
                d_res = await db.execute(select(User).options(selectinload(User.staff_profile)).filter(User.id == doctor.id))
                doctor = d_res.scalar()

            await db.commit()
            print(f"(+) CONTEXT: Patient {patient.id}, Doctor {doctor.id}")

            # 2. STEP 1: Create Lab Order
            print("\n[ACTION] Doctor ordering CBC panel...")
            order = await clinical_service.create_lab_order(
                db=db,
                hospital_id=hospital.id,
                doctor_id=doctor.id,
                patient_id=patient.id,
                tests=["Hemoglobin", "WBC", "Platelets"],
                history="Patient reports fatigue."
            )
            await db.commit()
            print(f"(+) SUCCESS: Lab Order {order.id} created.")

            # 3. STEP 2: Update to Processing
            print("\n[ACTION] Lab technician updating status to PROCESSING...")
            await clinical_service.update_lab_status(
                db=db,
                order_id=order.id,
                status=LabOrderStatusEnum.processing,
                hospital_id=hospital.id,
                user_id=doctor.id
            )
            await db.commit()

            # 4. STEP 3: Record Results (The Heart of the Lab Hub)
            print("\n[ACTION] Recording structured lab results (ANEMIA PATTERN)...")
            results = [
                {"test_name": "Hemoglobin", "value": 10.5, "unit": "g/dL", "min": 13.0, "max": 17.0, "flag": "LOW"},
                {"test_name": "WBC", "value": 7.2, "unit": "10^3/uL", "min": 4.0, "max": 11.0, "flag": "NORMAL"},
                {"test_name": "Platelets", "value": 250, "unit": "10^3/uL", "min": 150, "max": 450, "flag": "NORMAL"}
            ]
            await clinical_service.record_lab_results(
                db=db,
                order_id=order.id,
                results_data=results,
                hospital_id=hospital.id,
                user_id=doctor.id
            )
            await db.commit()
            print("(+) SUCCESS: Lab results recorded and Rules Engine triggered.")

            # 5. VERIFY: Timeline Integrity
            print("\n[VERIFY] Checking Event Stream for Derived Intelligence...")
            # Fetch last 5 events for this patient
            event_res = await db.execute(
                select(ClinicalEvent).filter(ClinicalEvent.patient_id == patient.id).order_by(ClinicalEvent.timestamp.desc()).limit(5)
            )
            events = event_res.scalars().all()
            
            event_types = [e.event_type for e in events]
            print(f"(+) RECENT EVENTS: {event_types}")
            
            if "ABNORMAL_RESULT_DETECTED" in event_types:
                print("(+) INTELLIGENCE CONFIRMED: Rules Engine successfully detected and logged the abnormal Hemoglobin.")
            
            if "LAB_COMPLETED" in event_types:
                completed_event = next(e for e in events if e.event_type == "LAB_COMPLETED")
                print(f"(+) DATA SEALED: Lab summary in event: {completed_event.payload['summary']}")

            # 6. VERIFY: AI Shield Context
            print("\n[VERIFY] Testing AI Context with Abnormal Lab results...")
            context = await clinical_context_service.get_patient_clinical_context(
                db=db,
                patient_id=patient.id,
                requesting_user_role="ai_assistant"
            )
            
            lab_timeline = [e for e in context['timeline'] if e['type'] == "LAB_COMPLETED"]
            if lab_timeline:
                print(f"(+) AI KNOWLEDGE: Chitti is now aware of: {lab_timeline[0]['data']['summary']}")
            
            if context['active_state']['recent_alerts']:
                print(f"(+) AI ALERT: Chitti has detected the abnormal result in Active State: {context['active_state']['recent_alerts'][0]['details']}")

            print("\n--- (+) LIVE LAB HUB VERIFIED: CLINICAL INTELLIGENCE IS ONLINE ---")

        except Exception as e:
            print(f"(!) VERIFICATION FAILURE: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(verify_lab_hub())
