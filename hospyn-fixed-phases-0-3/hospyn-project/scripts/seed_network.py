import asyncio
import uuid
import sys
import os
from datetime import datetime, timedelta

# Ensure app is in path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import get_writer_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import (
    User, RoleEnum, Hospital, OrganizationTypeEnum, Patient, Department, StaffProfile, Doctor,
    QueueToken, QueueTokenStatus, QueueEntry, PatientVisit, DigitalPrescription,
    PharmacyInventory, InventoryTransaction, InventoryTransactionType,
    LabDiagnosticOrder, LabOrderStatusEnum,
    Invoice, BillItem, Payment, PaymentStatus
)
from app.core.security import get_password_hash

async def seed_network():
    print(">>> Hospyn Network Seeder Initiated...")
    engine = get_writer_engine()
    SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with SessionLocal() as db:
        print("1. Creating System Super Admin...")
        admin_id = uuid.uuid4()
        super_admin = User(
            id=admin_id,
            email="superadmin@hospyn.com",
            hashed_password=get_password_hash("password123"),
            role=RoleEnum.admin,
            first_name="Hospyn",
            last_name="SuperAdmin",
            is_active=True
        )
        db.add(super_admin)
        
        credentials = []
        credentials.append(("Super Admin", "superadmin@hospyn.com", "password123"))

        hospitals_data = [
            {"name": "City Small Clinic", "type": OrganizationTypeEnum.hospital, "code": "CSC01"},
            {"name": "Metro Medium Care", "type": OrganizationTypeEnum.hospital, "code": "MMC02"},
            {"name": "Apollo Large Multi-Specialty", "type": OrganizationTypeEnum.hospital, "code": "ALM03"},
            {"name": "Standalone Partner Pharma", "type": OrganizationTypeEnum.pharmacy, "code": "SPP04"},
            {"name": "Standalone Diagnostics Lab", "type": OrganizationTypeEnum.lab, "code": "SDL05"}
        ]
        
        entities = []
        
        print("2. Generating 5 Network Entities...")
        for h_data in hospitals_data:
            hid = uuid.uuid4()
            hosp = Hospital(
                id=hid,
                hospyn_id=f"HOSPYN-{h_data['code']}",
                short_code=h_data['code'],
                org_type=h_data['type'],
                name=h_data['name'],
                registration_number=f"REG-{h_data['code']}-2026",
                qr_code_id=f"QR-{h_data['code']}-9999"
            )
            db.add(hosp)
            entities.append(hosp)
            
            # Create Owner/Admin for this entity
            uid = uuid.uuid4()
            user_email = f"admin@{h_data['code'].lower()}.com"
            user = User(
                id=uid,
                email=user_email,
                hashed_password=get_password_hash("password123"),
                role=RoleEnum.hospital_admin,
                first_name="Admin",
                last_name=h_data['code'],
                is_active=True
            )
            db.add(user)
            
            staff = StaffProfile(
                user_id=uid,
                hospital_id=hid,
                job_title="Administration"
            )
            db.add(staff)
            credentials.append((f"{h_data['name']} Owner", user_email, "password123"))

            # Create specific staff based on type
            if h_data['type'] == OrganizationTypeEnum.hospital:
                # Add a Doctor
                doc_uid = uuid.uuid4()
                doc_email = f"doctor@{h_data['code'].lower()}.com"
                doc_user = User(
                    id=doc_uid, email=doc_email, hashed_password=get_password_hash("password123"),
                    role=RoleEnum.doctor, first_name="Dr.", last_name="Smith", is_active=True
                )
                db.add(doc_user)
                doc_profile = Doctor(user_id=doc_uid, license_number=f"LIC-{h_data['code']}")
                db.add(doc_profile)
                staff_doc = StaffProfile(user_id=doc_uid, hospital_id=hid, job_title="Doctor")
                db.add(staff_doc)
                credentials.append((f"Doctor - {h_data['name']}", doc_email, "password123"))

            elif h_data['type'] == OrganizationTypeEnum.pharmacy:
                # Add a Pharmacist
                pharma_uid = uuid.uuid4()
                pharma_email = f"pharmacist@{h_data['code'].lower()}.com"
                pharma_user = User(
                    id=pharma_uid, email=pharma_email, hashed_password=get_password_hash("password123"),
                    role=RoleEnum.pharmacy, first_name="Pharma", last_name="Tech", is_active=True
                )
                db.add(pharma_user)
                staff_pharma = StaffProfile(user_id=pharma_uid, hospital_id=hid, job_title="Pharmacist")
                db.add(staff_pharma)
                credentials.append((f"Partner Pharmacist", pharma_email, "password123"))

            elif h_data['type'] == OrganizationTypeEnum.lab:
                # Add a Lab Tech
                lab_uid = uuid.uuid4()
                lab_email = f"labtech@{h_data['code'].lower()}.com"
                lab_user = User(
                    id=lab_uid, email=lab_email, hashed_password=get_password_hash("password123"),
                    role=RoleEnum.lab, first_name="Lab", last_name="Tech", is_active=True
                )
                db.add(lab_user)
                staff_lab = StaffProfile(user_id=lab_uid, hospital_id=hid, job_title="Lab Tech")
                db.add(staff_lab)
                credentials.append((f"Partner Lab Tech", lab_email, "password123"))

        print("3. Generating Patients and Simulating PhonePe QR Flow...")
        # Create a Patient
        patient_uid = uuid.uuid4()
        patient_email = "patient@hospyn.com"
        patient_user = User(
            id=patient_uid, email=patient_email, hashed_password=get_password_hash("password123"),
            role=RoleEnum.patient, first_name="John", last_name="Doe", is_active=True
        )
        db.add(patient_user)
        
        # We will link the patient to the Medium Hospital originally
        med_hospital = entities[1] 
        patient = Patient(
            user_id=patient_uid,
            hospyn_id="PAT-999999",
            phone_number="+1234567890",
            hospital_id=med_hospital.id,
            gender="Male", blood_group="O+"
        )
        db.add(patient)
        credentials.append(("Patient (John Doe)", patient_email, "password123"))

        await db.commit() # Commit to get IDs

        print("4. Creating Clinical Transactions...")
        # Get the doctor from Medium Care
        stmt_doc = select(Doctor).join(StaffProfile, Doctor.user_id == StaffProfile.user_id).where(StaffProfile.hospital_id == med_hospital.id)
        doctor = (await db.execute(stmt_doc)).scalar_one()

        # Visit
        visit = PatientVisit(
            patient_id=patient.id, hospital_id=med_hospital.id, doctor_id=doctor.id,
            clinic_name=med_hospital.name, visit_reason="Fever", symptoms="High temp, cough", department="General Medicine"
        )
        db.add(visit)

        # Prescription written by Doctor
        rx = DigitalPrescription(
            patient_id=patient.id, doctor_id=doctor.id, hospital_id=med_hospital.id,
            diagnosis="Viral Infection", notes="Take rest", status="ACTIVE"
        )
        db.add(rx)

        # Lab Order written by Doctor
        lab_order = LabDiagnosticOrder(
            patient_id=patient.id, doctor_id=doctor.id,
            clinical_history="Fever 3 days", status=LabOrderStatusEnum.ordered,
            hospital_id=med_hospital.id
        )
        db.add(lab_order)

        await db.commit()

        print("5. Generating Partner Fulfillments (The Flow)...")
        # Patient pushes prescription to Standalone Partner Pharma
        partner_pharma = entities[3]
        
        # Patient pushes lab order to Standalone Partner Lab
        partner_lab = entities[4]

        # Simulate Pharma fulfilling the prescription
        # (This is what happens when pharma dashboard clicks "Dispense")
        inv_transaction = InventoryTransaction(
            hospital_id=partner_pharma.id, # Partner Pharma's own inventory
            item_name="Paracetamol",
            transaction_type=InventoryTransactionType.DISPENSE,
            quantity=10, unit_price=5.0, total_amount=50.0,
            reference_id=str(rx.id),
            notes="Fulfilled via Hospyn Network QR Push"
        )
        db.add(inv_transaction)
        
        rx.status = "FULFILLED" # Update Rx Status

        await db.commit()

        print("\n\n=== SEEDING COMPLETE! The Hospyn Network is LIVE. ===")
        print("\n" + "="*60)
        print(" ::: LOGIN CREDENTIALS TO TRACE THE DATA FLOW ::: ")
        print("="*60)
        print(f"{'ROLE / ENTITY':<35} | {'EMAIL':<30} | PASSWORD")
        print("-" * 80)
        for cred in credentials:
            print(f"{cred[0]:<35} | {cred[1]:<30} | {cred[2]}")
        print("="*60)
        
if __name__ == "__main__":
    asyncio.run(seed_network())
