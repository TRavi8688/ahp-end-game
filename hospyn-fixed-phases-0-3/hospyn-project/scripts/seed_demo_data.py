import asyncio
import os
import sys

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import get_writer_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from app.models.models import (
    User, Patient, Hospital, Doctor, StaffProfile, PatientVisit,
    MedicalRecord, Condition, Medication, Allergy, LabDiagnosticOrder,
    LabResult, DigitalPrescription, PrescriptionItem
)
from app.models.models import VisitStatusEnum, RecordTypeEnum, LabOrderStatusEnum, PrescriptionStatusEnum, AddedByEnum
from app.core.security import get_password_hash
from datetime import datetime, timezone, timedelta

async def seed_demo():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    try:
        print("[SEED] Starting idempotent database seeding for demo patient...")
        
        # 0. Hospital Setup
        hosp_res = await db.execute(select(Hospital).where(Hospital.short_code == "HOSP1"))
        hospital = hosp_res.scalars().first()
        if not hospital:
            hospital = Hospital(
                hospyn_id="HOSP-GLOBAL-001",
                short_code="HOSP1",
                name="Hospyn Global Hospital",
                registration_number="REG-12345"
            )
            db.add(hospital)
            await db.flush()
            print("[SEED] Created hospital: Hospyn Global Hospital")
        
        # 1. Doctor User Setup
        doctor_email = "doctor@hospyn.com"
        doc_user_res = await db.execute(select(User).where(User.email == doctor_email))
        doc_user = doc_user_res.scalars().first()
        if not doc_user:
            doc_user = User(
                email=doctor_email,
                hashed_password=get_password_hash("Hospyn123!"),
                is_active=True,
                role="doctor",
                first_name="Mulajna",
                last_name="Surgeon"
            )
            db.add(doc_user)
            await db.flush()
            
            staff = StaffProfile(user_id=doc_user.id, hospital_id=hospital.id)
            db.add(staff)
            
            doctor = Doctor(
                user_id=doc_user.id,
                specialty="Cardiovascular Surgery",
                license_number="LIC-SURGEON-8888",
                license_status="verified"
            )
            db.add(doctor)
            await db.flush()
            print("[SEED] Created Doctor User and Profiles")
        else:
            doctor_res = await db.execute(select(Doctor).where(Doctor.user_id == doc_user.id))
            doctor = doctor_res.scalars().first()
            if not doctor:
                staff = StaffProfile(user_id=doc_user.id, hospital_id=hospital.id)
                db.add(staff)
                
                doctor = Doctor(
                    user_id=doc_user.id,
                    specialty="Cardiovascular Surgery",
                    license_number="LIC-SURGEON-8888",
                    license_status="verified"
                )
                db.add(doctor)
                await db.flush()
                print("[SEED] Doctor User existed, but Profile was missing. Recreated Profile.")
            else:
                print("[SEED] Doctor User and Profiles already exist")

        # 2. Patient User Setup
        patient_email = "test@hospyn.com"
        pat_user_res = await db.execute(select(User).where(User.email == patient_email))
        pat_user = pat_user_res.scalars().first()
        if not pat_user:
            pat_user = User(
                email=patient_email,
                hashed_password=get_password_hash("Hospyn123!"),
                is_active=True,
                role="patient",
                first_name="Rahul",
                last_name="Sharma"
            )
            db.add(pat_user)
            await db.flush()
            
            patient = Patient(
                user_id=pat_user.id,
                hospyn_id="HOSPYN-000000-TEST",
                phone_number="9876543210",
                gender="Male"
            )
            db.add(patient)
            await db.flush()
            print("[SEED] Created Patient User and Profile")
        else:
            patient_res = await db.execute(select(Patient).where(Patient.user_id == pat_user.id))
            patient = patient_res.scalars().first()
            if not patient:
                patient = Patient(
                    user_id=pat_user.id,
                    hospyn_id="HOSPYN-000000-TEST",
                    phone_number="9876543210",
                    gender="Male"
                )
                db.add(patient)
                await db.flush()
                print("[SEED] Patient User existed, but Profile was missing. Recreated Profile.")
            else:
                print("[SEED] Patient User and Profile already exist")

        # To make it clean and repeatable, delete any existing clinical records for this patient
        print("[SEED] Cleaning up existing clinical records for patient to avoid duplicates...")
        
        # Select all prescriptions first to clean items
        pres_res = await db.execute(select(DigitalPrescription).where(DigitalPrescription.patient_id == patient.id))
        prescriptions = pres_res.scalars().all()
        for p in prescriptions:
            await db.execute(delete(PrescriptionItem).where(PrescriptionItem.prescription_id == p.id))
        await db.execute(delete(DigitalPrescription).where(DigitalPrescription.patient_id == patient.id))
        
        # Select all lab orders to clean results
        orders_res = await db.execute(select(LabDiagnosticOrder).where(LabDiagnosticOrder.patient_id == patient.id))
        orders = orders_res.scalars().all()
        for o in orders:
            await db.execute(delete(LabResult).where(LabResult.order_id == o.id))
        await db.execute(delete(LabDiagnosticOrder).where(LabDiagnosticOrder.patient_id == patient.id))
        
        # Clean other direct patient associations
        await db.execute(delete(LabResult).where(LabResult.patient_id == patient.id))
        await db.execute(delete(MedicalRecord).where(MedicalRecord.patient_id == patient.id))
        await db.execute(delete(Condition).where(Condition.patient_id == patient.id))
        await db.execute(delete(Medication).where(Medication.patient_id == patient.id))
        await db.execute(delete(Allergy).where(Allergy.patient_id == patient.id))
        await db.execute(delete(PatientVisit).where(PatientVisit.patient_id == patient.id))
        await db.flush()

        # 3. Create fresh Patient Visits, Medical Records, Prescriptions, Lab Orders, Conditions, Medications, Allergies
        print("[SEED] Inserting comprehensive dummy clinical data...")
        
        # 3a. Add Conditions
        hypertension = Condition(
            patient_id=patient.id,
            hospital_id=hospital.id,
            name="Essential Hypertension",
            added_by=AddedByEnum.doctor,
            confirmed_by_patient=True
        )
        diabetes = Condition(
            patient_id=patient.id,
            hospital_id=hospital.id,
            name="Type 2 Diabetes Mellitus",
            added_by=AddedByEnum.doctor,
            confirmed_by_patient=True
        )
        db.add_all([hypertension, diabetes])
        
        # 3b. Add Medications
        amlodipine = Medication(
            patient_id=patient.id,
            hospital_id=hospital.id,
            generic_name="Amlodipine",
            dosage="5 mg",
            frequency="Once daily in the morning",
            active=True,
            added_by=AddedByEnum.doctor,
            confirmed_by_patient=True
        )
        metformin = Medication(
            patient_id=patient.id,
            hospital_id=hospital.id,
            generic_name="Metformin",
            dosage="500 mg",
            frequency="Twice daily after meals",
            active=True,
            added_by=AddedByEnum.doctor,
            confirmed_by_patient=True
        )
        db.add_all([amlodipine, metformin])
        
        # 3c. Add Allergies
        allergy = Allergy(
            patient_id=patient.id,
            hospital_id=hospital.id,
            allergen="Penicillin G",
            severity="High",
            added_by=AddedByEnum.doctor,
            confirmed_by_patient=True
        )
        db.add(allergy)
        await db.flush()

        # 3d. Add a Patient Visit (grouped chronological ledger)
        visit_date = datetime.now(timezone.utc) - timedelta(days=2)
        visit = PatientVisit(
            patient_id=patient.id,
            hospital_id=hospital.id,
            visit_reason="Routine Hypertension & Diabetes Follow-up",
            symptoms="Occasional mild morning headache, fatigue.",
            department="General Medicine",
            doctor_name="Dr. Mulajna Surgeon",
            status=VisitStatusEnum.completed,
            queue_token="TKT-042",
            check_in_time=visit_date
        )
        db.add(visit)
        await db.flush()
        
        # 3e. Add a Prescription under this Visit
        prescription = DigitalPrescription(
            patient_id=patient.id,
            hospital_id=hospital.id,
            doctor_id=doctor.id,
            visit_id=visit.id,
            status=PrescriptionStatusEnum.fulfilled,
            diagnosis="Essential Hypertension & Type 2 Diabetes Mellitus - Controlled",
            medications={"medications": [
                {"name": "Amlodipine 5mg", "dosage": "5mg", "frequency": "1-0-0", "duration": "30 days"},
                {"name": "Metformin 500mg", "dosage": "500mg", "frequency": "1-0-1", "duration": "30 days"}
            ]},
            notes="Please follow low-sodium and low-glycemic diet. Check blood pressure twice weekly.",
            qr_code_id="PPHR-TEST-PRESCRIPTION-001",
            signature_hash="sha256_mock_signature_hash_value_for_verification"
        )
        db.add(prescription)
        await db.flush()
        
        # Add items to the prescription
        p_item1 = PrescriptionItem(
            prescription_id=prescription.id,
            name="Amlodipine 5mg",
            dosage="5mg",
            frequency="Once daily",
            duration="30 days",
            instructions="Take in the morning before breakfast"
        )
        p_item2 = PrescriptionItem(
            prescription_id=prescription.id,
            name="Metformin 500mg",
            dosage="500mg",
            frequency="Twice daily",
            duration="30 days",
            instructions="Take after breakfast and after dinner"
        )
        db.add_all([p_item1, p_item2])
        
        # 3f. Add a Lab Diagnostic Order under this Visit
        lab_order = LabDiagnosticOrder(
            patient_id=patient.id,
            hospital_id=hospital.id,
            doctor_id=doctor.id,
            visit_id=visit.id,
            status=LabOrderStatusEnum.completed,
            tests={"tests": [
                {"test_name": "Hemoglobin A1c (HbA1c)", "priority": "routine"},
                {"test_name": "Lipid Profile", "priority": "routine"}
            ]},
            clinical_history="Follow-up patient with T2DM and Hypertension.",
            sample_id="SMPL-778899",
            collected_at=visit_date + timedelta(hours=1),
            completed_at=visit_date + timedelta(hours=4)
        )
        db.add(lab_order)
        await db.flush()
        
        # Add results to the lab order
        res1 = LabResult(
            patient_id=patient.id,
            hospital_id=hospital.id,
            order_id=lab_order.id,
            test_name="Hemoglobin A1c (HbA1c)",
            value="6.4",
            unit="%",
            reference_range="< 5.7% (Normal), 5.7% - 6.4% (Prediabetes), >= 6.5% (Diabetes)",
            is_abnormal=True,
            clinical_remarks="Patient is prediabetic/borderline diabetic under medication.",
            observation_date=visit_date + timedelta(hours=3)
        )
        res2 = LabResult(
            patient_id=patient.id,
            hospital_id=hospital.id,
            order_id=lab_order.id,
            test_name="Total Cholesterol",
            value="185",
            unit="mg/dL",
            reference_range="< 200 mg/dL (Desirable)",
            is_abnormal=False,
            clinical_remarks="Desirable range.",
            observation_date=visit_date + timedelta(hours=3)
        )
        db.add_all([res1, res2])
        
        # 3g. Add a Medical Record (Lab Report PDF upload) under this Visit
        med_rec = MedicalRecord(
            patient_id=patient.id,
            hospital_id=hospital.id,
            visit_id=visit.id,
            type=RecordTypeEnum.lab_report,
            file_url="https://storage.googleapis.com/hospyn-medical-records/lab-report-hba1c-lipid.pdf",
            record_name="HbA1c & Lipid Panel Report",
            hospital_name="Hospyn Global Hospital",
            raw_text="HbA1c: 6.4%, Total Cholesterol: 185 mg/dL. Dr. Mulajna Surgeon signature.",
            ai_summary="HbA1c level is 6.4% (prediabetic) and Total Cholesterol is 185 mg/dL (Normal). Recommended continued metformin therapy and diet monitoring.",
            patient_summary="Your HbA1c (sugar level) is 6.4% which is slightly high. Your cholesterol level is 185 mg/dL which is healthy.",
            doctor_summary="Patient HbA1c borderline (6.4%). Lipid panel within normal limits. Action: Continue Metformin 500mg BID and Amlodipine 5mg QD.",
            ocr_confidence_score=0.98,
            needs_verification=False
        )
        db.add(med_rec)
        
        await db.commit()
        print("[SEED] Successfully seeded comprehensive, high-fidelity patient clinical records!")
        
    except Exception as e:
        await db.rollback()
        print(f"[ERROR] Seeding failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(seed_demo())
