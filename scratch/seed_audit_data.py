import asyncio
import uuid
import random
from datetime import datetime, timedelta
from app.core.database import AsyncSessionLocal
from app.models.models import MedicalRecord, Allergy, Condition, Medication, Patient

async def seed_audit_data():
    db = AsyncSessionLocal()
    patient_id = uuid.UUID('017f5db3-5b03-4abc-a732-f45802a39efc')
    hospital_id = uuid.UUID('f0f0f0f0-f0f0-4040-b0b0-a0a0a0a0a0a0')
    
    try:
        # 1. Add Medical Records
        db.add_all([
            MedicalRecord(
                patient_id=patient_id,
                hospital_id=hospital_id,
                type='lab_report',
                record_name="Full Blood Count",
                hospital_name="Hospyn Forensic Center",
                file_url="https://storage.googleapis.com/hospyn-reports/blood_report_may.pdf",
                ai_summary="Hemoglobin is slightly low (11.5 g/dL). Recommend iron-rich diet.",
                ai_processed_at=datetime.now() - timedelta(days=10),
                created_at=datetime.now() - timedelta(days=10)
            ),
            MedicalRecord(
                patient_id=patient_id,
                hospital_id=hospital_id,
                type='prescription',
                record_name="Diabetes Maintenance",
                hospital_name="Apex Care Clinic",
                file_url="https://storage.googleapis.com/hospyn-reports/prescription_june.jpg",
                ai_summary="Prescribed Metformin 500mg once daily for Type 2 Diabetes management.",
                ai_processed_at=datetime.now() - timedelta(days=5),
                created_at=datetime.now() - timedelta(days=5)
            )
        ])
        
        # 2. Add Allergies
        db.add_all([
            Allergy(patient_id=patient_id, hospital_id=hospital_id, allergen='Sulfa Drugs', severity='Moderate', added_by='system'),
            Allergy(patient_id=patient_id, hospital_id=hospital_id, allergen='Dust Mites', severity='Low', added_by='system')
        ])
        
        # 3. Add Conditions
        db.add_all([
            Condition(patient_id=patient_id, hospital_id=hospital_id, name='Type 2 Diabetes', added_by='system'),
            Condition(patient_id=patient_id, hospital_id=hospital_id, name='Hypertension', added_by='system')
        ])
        
        # 4. Add Medications
        db.add_all([
            Medication(patient_id=patient_id, hospital_id=hospital_id, generic_name='Metformin', dosage='500mg', frequency='Once daily', added_by='system'),
            Medication(patient_id=patient_id, hospital_id=hospital_id, generic_name='Lisinopril', dosage='10mg', frequency='Once daily', added_by='system')
        ])
        
        await db.commit()
        print("SUCCESS: Audit Data Seeded for Patient 017f5db3!")
    except Exception as e:
        print(f"ERROR: Seeding Error: {e}")
        await db.rollback()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(seed_audit_data())
