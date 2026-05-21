import asyncio
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
import random

# Add parent directory to path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.core.database import get_writer_engine
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete

from app.models.models import (
    User, Patient, Hospital, Doctor, StaffProfile, PatientVisit,
    HospitalSettings, HospitalBranch, Department, Bed, PharmacyInventory,
    Invoice, BillItem, Payment, RoleEnum, BedStatusEnum, PaymentStatus, PaymentMethod,
    VisitStatusEnum
)
from app.core.security import get_password_hash

# Real-world Hospital Profiles
HOSPITAL_PROFILES = [
    {
        "email": "owner@apollo.com",
        "short_code": "APOLLO",
        "hospyn_id": "HOSP-APOLLO",
        "name": "Apollo Hospitals, Delhi",
        "reg_no": "REG-APOLLO-1122",
        "scale": "High",
        "settings": {
            "enable_pharmacy": True,
            "enable_labs": True,
            "enable_inpatient_beds": True,
            "enable_hr": True,
            "enable_billing": True,
            "max_beds_configured": 50
        },
        "branches": [
            {"name": "Apollo Delhi Indraprastha Main", "city": "New Delhi", "lat": 28.5355, "lng": 77.2916},
            {"name": "Apollo Clinic Noida Sector 62", "city": "Noida", "lat": 28.6273, "lng": 77.3727}
        ],
        "departments": ["General Medicine", "Cardiology", "ICU", "Pediatrics", "Emergency"],
        "drugs": [
            {"name": "Paracetamol 650mg (Dolo)", "generic": "Paracetamol", "qty": 450, "price": 1.5, "reorder": 50},
            {"name": "Amoxicillin 500mg", "generic": "Amoxicillin", "qty": 180, "price": 4.5, "reorder": 30},
            {"name": "Metformin 500mg (Glycomet)", "generic": "Metformin", "qty": 600, "price": 2.2, "reorder": 100},
            {"name": "Atorvastatin 10mg (Lipvas)", "generic": "Atorvastatin", "qty": 8, "price": 6.8, "reorder": 20}, # Low stock alert
            {"name": "Pantoprazole 40mg (Pan-40)", "generic": "Pantoprazole", "qty": 350, "price": 3.5, "reorder": 40}
        ]
    },
    {
        "email": "owner@narayana.com",
        "short_code": "NARAYANA",
        "hospyn_id": "HOSP-NARAYANA",
        "name": "Narayana Health, Bangalore",
        "reg_no": "REG-NARAYANA-3344",
        "scale": "High",
        "settings": {
            "enable_pharmacy": True,
            "enable_labs": True,
            "enable_inpatient_beds": True,
            "enable_hr": True,
            "enable_billing": True,
            "max_beds_configured": 80
        },
        "branches": [
            {"name": "Narayana Cardiac Centre Hosur Road", "city": "Bangalore", "lat": 12.8227, "lng": 77.6787},
            {"name": "Narayana Multispeciality Clinic Electronic City", "city": "Bangalore", "lat": 12.8452, "lng": 77.6635}
        ],
        "departments": ["Cardiology", "ICU", "General Medicine", "Cardiothoracic Surgery"],
        "drugs": [
            {"name": "Aspirin 75mg (Loprin)", "generic": "Aspirin", "qty": 900, "price": 1.0, "reorder": 100},
            {"name": "Clopidogrel 75mg (Clopilet)", "generic": "Clopidogrel", "qty": 5, "price": 5.5, "reorder": 50}, # Low stock alert
            {"name": "Metoprolol 25mg (Metolar)", "generic": "Metoprolol Succinate", "qty": 400, "price": 3.0, "reorder": 40},
            {"name": "Atorvastatin 20mg (Atorva)", "generic": "Atorvastatin", "qty": 550, "price": 9.5, "reorder": 30}
        ]
    },
    {
        "email": "owner@cloudnine.com",
        "short_code": "CLOUDNINE",
        "hospyn_id": "HOSP-CLOUDNINE",
        "name": "Cloudnine Hospital, Gurgaon",
        "reg_no": "REG-CLOUDNINE-5566",
        "scale": "Mid",
        "settings": {
            "enable_pharmacy": True,
            "enable_labs": False,
            "enable_inpatient_beds": True,
            "enable_hr": True,
            "enable_billing": True,
            "max_beds_configured": 15
        },
        "branches": [
            {"name": "Cloudnine Maternity Gurgaon Sector 47", "city": "Gurgaon", "lat": 28.4312, "lng": 77.0428}
        ],
        "departments": ["Maternity", "Pediatrics", "Neonatal ICU (NICU)"],
        "drugs": [
            {"name": "Folvite 5mg (Folic Acid)", "generic": "Folic Acid", "qty": 800, "price": 2.0, "reorder": 50},
            {"name": "Calcium Sandoz", "generic": "Calcium & Vit D3", "qty": 400, "price": 4.0, "reorder": 40},
            {"name": "Iron Dextran (Orofer)", "generic": "Iron", "qty": 3, "price": 12.0, "reorder": 20} # Low stock alert
        ]
    },
    {
        "email": "owner@carefirst.com",
        "short_code": "CAREFIRST",
        "hospyn_id": "HOSP-CAREFIRST",
        "name": "Care First Clinic, Mumbai",
        "reg_no": "REG-CAREFIRST-7788",
        "scale": "Low",
        "settings": {
            "enable_pharmacy": False,
            "enable_labs": False,
            "enable_inpatient_beds": False,
            "enable_hr": False,
            "enable_billing": True,
            "max_beds_configured": 0
        },
        "branches": [
            {"name": "Care First Clinic Andheri West", "city": "Mumbai", "lat": 19.1136, "lng": 72.8697}
        ],
        "departments": ["General Practice", "Pediatrics"],
        "drugs": []
    },
    {
        "email": "owner@medall.com",
        "short_code": "MEDALL",
        "hospyn_id": "HOSP-MEDALL",
        "name": "Medall Diagnostics, Chennai",
        "reg_no": "REG-MEDALL-9900",
        "scale": "Low",
        "settings": {
            "enable_pharmacy": False,
            "enable_labs": True,
            "enable_inpatient_beds": False,
            "enable_hr": False,
            "enable_billing": True,
            "max_beds_configured": 0
        },
        "branches": [
            {"name": "Medall Diagnostic Lab T-Nagar", "city": "Chennai", "lat": 13.0418, "lng": 80.2341}
        ],
        "departments": ["Diagnostics", "Pathology"],
        "drugs": []
    }
]

# Patient names for seeding
PATIENT_POOL = [
    {"first": "Siddharth", "last": "Nair", "phone": "+919888877771", "gender": "Male", "dob": "1988-04-12"},
    {"first": "Ananya", "last": "Iyer", "phone": "+919888877772", "gender": "Female", "dob": "1994-08-25"},
    {"first": "Rohan", "last": "Mehta", "phone": "+919888877773", "gender": "Male", "dob": "1982-11-03"},
    {"first": "Priyanka", "last": "Reddy", "phone": "+919888877774", "gender": "Female", "dob": "1991-01-30"},
    {"first": "Vikram", "last": "Singh", "phone": "+919888877775", "gender": "Male", "dob": "1975-06-15"}
]

# Doctor names
DOCTOR_POOL = [
    {"first": "Dr. Ramesh", "last": "Gupta", "specialty": "Cardiology", "license": "LIC-RG-552"},
    {"first": "Dr. Sunita", "last": "Krishnan", "specialty": "Pediatrics", "license": "LIC-SK-901"},
    {"first": "Dr. Amit", "last": "Sharma", "specialty": "General Medicine", "license": "LIC-AS-345"},
    {"first": "Dr. Kavitha", "last": "Rao", "specialty": "Maternity/OBGYN", "license": "LIC-KR-219"},
    {"first": "Dr. Pranav", "last": "Patel", "specialty": "ICU Specialist", "license": "LIC-PP-812"}
]

async def seed_five_hospitals():
    engine = get_writer_engine()
    db = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)()
    
    try:
        print("[SEED] Starting Idempotent Seeding for Five Real-World Indian Hospitals...")
        
        # 1. Clean up existing records for these five hospitals to enable re-runs
        for profile in HOSPITAL_PROFILES:
            email = profile["email"]
            print(f"[SEED] Cleaning up previous runs for owner: {email} / {profile['name']}...")
            
            # Find User
            user_res = await db.execute(select(User).where(User.email == email))
            owner_user = user_res.scalars().first()
            if owner_user:
                # Find Hospital
                hosp_res = await db.execute(select(Hospital).where(Hospital.owner_id == owner_user.id))
                hospital = hosp_res.scalars().first()
                
                if hospital:
                    hosp_id = hospital.id
                    # Clean dependency tables
                    await db.execute(delete(Payment).where(Payment.hospital_id == hosp_id))
                    
                    # Invoices & BillItems
                    invoice_ids_res = await db.execute(select(Invoice.id).where(Invoice.hospital_id == hosp_id))
                    invoice_ids = invoice_ids_res.scalars().all()
                    for inv_id in invoice_ids:
                        await db.execute(delete(BillItem).where(BillItem.invoice_id == inv_id))
                    await db.execute(delete(Invoice).where(Invoice.hospital_id == hosp_id))
                    
                    # Beds, Inventory
                    await db.execute(delete(Bed).where(Bed.hospital_id == hosp_id))
                    await db.execute(delete(PharmacyInventory).where(PharmacyInventory.hospital_id == hosp_id))
                    
                    # PatientVisits
                    await db.execute(delete(PatientVisit).where(PatientVisit.hospital_id == hosp_id))
                    
                    # Staff & Doctors
                    await db.execute(delete(StaffProfile).where(StaffProfile.hospital_id == hosp_id))
                    
                    # Departments & Branches
                    await db.execute(delete(Department).where(Department.hospital_id == hosp_id))
                    await db.execute(delete(HospitalBranch).where(HospitalBranch.hospital_id == hosp_id))
                    await db.execute(delete(HospitalSettings).where(HospitalSettings.hospital_id == hosp_id))
                    
                    # Hospital itself
                    await db.execute(delete(Hospital).where(Hospital.id == hosp_id))
                
                # Delete owner User
                await db.execute(delete(User).where(User.id == owner_user.id))
                await db.flush()
                
        # Clean up general seeded patient users to prevent duplicate emails
        for profile in HOSPITAL_PROFILES:
            for pat in PATIENT_POOL:
                pat_email = f"patient.{pat['first'].lower()}.{pat['last'].lower()}@{profile['short_code'].lower()}.com"
                user_res = await db.execute(select(User).where(User.email == pat_email))
                pat_user = user_res.scalars().first()
                if pat_user:
                    await db.execute(delete(Patient).where(Patient.user_id == pat_user.id))
                    await db.execute(delete(User).where(User.id == pat_user.id))
        
            # Clean up seeded doctors
            for doc in DOCTOR_POOL:
                doc_email = f"doc.{doc['first'].split()[-1].lower()}@{profile['short_code'].lower()}.hospyn.com"
                user_res = await db.execute(select(User).where(User.email == doc_email))
                doc_user = user_res.scalars().first()
                if doc_user:
                    await db.execute(delete(Doctor).where(Doctor.user_id == doc_user.id))
                    await db.execute(delete(StaffProfile).where(StaffProfile.user_id == doc_user.id))
                    await db.execute(delete(User).where(User.id == doc_user.id))
                
        await db.flush()
        print("[SEED] Cleanup finished! Creating records...")
        
        # 2. Loop through and create each hospital
        for profile in HOSPITAL_PROFILES:
            email = profile["email"]
            print(f"[SEED] Creating Hospital: {profile['name']} ({profile['scale']}-level)...")
            
            # Create Owner User
            owner_user = User(
                email=email,
                hashed_password=get_password_hash("admin123"),
                is_active=True,
                role=RoleEnum.admin,
                first_name=profile["name"].split()[0],
                last_name="Owner",
                hospyn_id=profile["hospyn_id"]
            )
            db.add(owner_user)
            await db.flush()
            
            # Create Hospital
            hospital = Hospital(
                hospyn_id=profile["hospyn_id"],
                short_code=profile["short_code"],
                name=profile["name"],
                registration_number=profile["reg_no"],
                owner_id=owner_user.id,
                subscription_status="active",
                is_approved=True,
                verification_status="completed"
            )
            db.add(hospital)
            await db.flush()
            
            # Add StaffProfile for Owner to link to Hospital as well
            owner_staff = StaffProfile(
                user_id=owner_user.id,
                hospital_id=hospital.id
            )
            db.add(owner_staff)
            
            # Create Settings
            s = profile["settings"]
            settings = HospitalSettings(
                hospital_id=hospital.id,
                enable_pharmacy=s["enable_pharmacy"],
                enable_labs=s["enable_labs"],
                enable_inpatient_beds=s["enable_inpatient_beds"],
                enable_hr=s["enable_hr"],
                enable_billing=s["enable_billing"],
                max_beds_configured=s["max_beds_configured"],
                has_multiple_branches=len(profile["branches"]) > 1
            )
            db.add(settings)
            
            # Create Branches
            branch_instances = []
            for idx, br in enumerate(profile["branches"]):
                branch = HospitalBranch(
                    hospital_id=hospital.id,
                    name=br["name"],
                    city=br["city"],
                    is_active=True,
                    latitude=br["lat"],
                    longitude=br["lng"]
                )
                db.add(branch)
                branch_instances.append(branch)
            await db.flush()
            
            # Create Departments
            dept_instances = {}
            for dept_name in profile["departments"]:
                dept = Department(
                    hospital_id=hospital.id,
                    name=dept_name
                )
                db.add(dept)
                dept_instances[dept_name] = dept
            await db.flush()
            
            # Create Staff / Doctors
            seeded_doctors = []
            for doc in DOCTOR_POOL:
                # Only seed appropriate doctors based on department availability
                specialty = doc["specialty"]
                # Match specialty to seeded departments
                matched_dept = None
                if specialty == "Cardiology" and "Cardiology" in dept_instances:
                    matched_dept = dept_instances["Cardiology"]
                elif specialty == "Pediatrics" and "Pediatrics" in dept_instances:
                    matched_dept = dept_instances["Pediatrics"]
                elif specialty == "General Medicine" and "General Medicine" in dept_instances:
                    matched_dept = dept_instances["General Medicine"]
                elif specialty == "Maternity/OBGYN" and "Maternity" in dept_instances:
                    matched_dept = dept_instances["Maternity"]
                elif specialty == "ICU Specialist" and "ICU" in dept_instances:
                    matched_dept = dept_instances["ICU"]
                
                if matched_dept:
                    doc_email = f"doc.{doc['first'].split()[-1].lower()}@{profile['short_code'].lower()}.hospyn.com"
                    doc_user = User(
                        email=doc_email,
                        hashed_password=get_password_hash("doctor123"),
                        is_active=True,
                        role=RoleEnum.doctor,
                        first_name=doc["first"],
                        last_name=doc["last"],
                        hospyn_id=profile["hospyn_id"]
                    )
                    db.add(doc_user)
                    await db.flush()
                    
                    staff = StaffProfile(
                        user_id=doc_user.id,
                        hospital_id=hospital.id,
                        department_id=matched_dept.id,
                        branch_id=branch_instances[0].id # Primary branch
                    )
                    db.add(staff)
                    
                    doctor = Doctor(
                        user_id=doc_user.id,
                        specialty=specialty,
                        license_number=f"{doc['license']}-{profile['short_code']}",
                        license_status="verified"
                    )
                    db.add(doctor)
                    await db.flush()
                    seeded_doctors.append(doctor)
            
            # Seed Beds (if inpatient is enabled)
            if s["enable_inpatient_beds"]:
                bed_count = 8 if profile["scale"] == "Mid" else 20
                for b_num in range(1, bed_count + 1):
                    # Distribute across departments
                    depts_with_beds = [dept_instances[d] for d in dept_instances if d in ["ICU", "Maternity", "Neonatal ICU (NICU)", "General Medicine"]]
                    assigned_dept = random.choice(depts_with_beds) if depts_with_beds else list(dept_instances.values())[0]
                    
                    bed = Bed(
                        hospital_id=hospital.id,
                        department_id=assigned_dept.id,
                        bed_number=f"B-{assigned_dept.name[:3].upper()}-{b_num:02d}",
                        status=random.choice([BedStatusEnum.available, BedStatusEnum.occupied, BedStatusEnum.available])
                    )
                    db.add(bed)
            
            # Seed Pharmacy Inventory
            if s["enable_pharmacy"]:
                for drug in profile["drugs"]:
                    expiry = datetime.now(timezone.utc) + timedelta(days=random.randint(180, 720))
                    inv = PharmacyInventory(
                        hospital_id=hospital.id,
                        item_name=drug["name"],
                        generic_name=drug["generic"],
                        batch_number=f"BAT-{random.randint(10000, 99999)}",
                        expiry_date=expiry,
                        stock_quantity=float(drug["qty"]),
                        unit_price=float(drug["price"]),
                        reorder_level=float(drug["reorder"]),
                        hsn_code=f"HSN{random.randint(1000, 9999)}",
                        tax_percent=12.0
                    )
                    db.add(inv)
            
            # Create Seed Patients
            seeded_patients = []
            for pat in PATIENT_POOL:
                pat_email = f"patient.{pat['first'].lower()}.{pat['last'].lower()}@{profile['short_code'].lower()}.com"
                pat_user = User(
                    email=pat_email,
                    hashed_password=get_password_hash("patient123"),
                    is_active=True,
                    role=RoleEnum.patient,
                    first_name=pat["first"],
                    last_name=pat["last"],
                    hospyn_id=profile["hospyn_id"]
                )
                db.add(pat_user)
                await db.flush()
                
                patient = Patient(
                    user_id=pat_user.id,
                    hospyn_id=f"HOSP-{profile['short_code']}-{random.randint(100000, 999999)}",
                    phone_number=pat["phone"],
                    date_of_birth=pat["dob"],
                    gender=pat["gender"]
                )
                db.add(patient)
                await db.flush()
                seeded_patients.append((patient, pat_user))
            
            # Generate Chronological Visits, Invoices, BillItems, and Rupee-precise Payments
            # Make sure we have 6-12 realistic historic payments per hospital branch
            for branch_inst in branch_instances:
                visit_count = random.randint(6, 10)
                for v_idx in range(visit_count):
                    patient_obj, patient_user = random.choice(seeded_patients)
                    visit_time = datetime.now(timezone.utc) - timedelta(days=v_idx, hours=random.randint(1, 12))
                    
                    # Choose a doctor
                    doc_name = "Dr. General Practice"
                    dept_name = "General Practice"
                    if seeded_doctors:
                        doc_obj = random.choice(seeded_doctors)
                        # Fetch the user matching doctor to get name
                        doc_user_res = await db.execute(select(User).where(User.id == doc_obj.user_id))
                        d_user = doc_user_res.scalars().first()
                        doc_name = f"{d_user.first_name} {d_user.last_name}"
                        specialty = doc_obj.specialty
                        # Match specialty back to dept
                        dept_name = specialty
                        
                    visit = PatientVisit(
                        patient_id=patient_obj.id,
                        hospital_id=hospital.id,
                        visit_reason="Routine consultation and general diagnostic review.",
                        symptoms="Mild fever, throat pain, headache.",
                        department=dept_name,
                        doctor_name=doc_name,
                        status=VisitStatusEnum.completed,
                        queue_token=f"TKT-{v_idx:03d}",
                        check_in_time=visit_time
                    )
                    db.add(visit)
                    await db.flush()
                    
                    invoice_num = f"INV-{profile['short_code']}-{visit_time.strftime('%Y%m%d')}-{v_idx:03d}-{random.randint(10000, 99999)}"
                    invoice = Invoice(
                        invoice_number=invoice_num,
                        patient_id=patient_obj.id,
                        hospital_id=hospital.id,
                        visit_id=visit.id,
                        status=PaymentStatus.PAID,
                        due_date=visit_time
                    )
                    db.add(invoice)
                    await db.flush()
                    
                    # Generate BillItems
                    bill_items = []
                    
                    # 1. Consultation fee
                    consult_price = float(random.choice([350.0, 500.0, 800.0]))
                    consult_item = BillItem(
                        invoice_id=invoice.id,
                        item_name=f"OPD Consultation - {doc_name}",
                        item_category="Consultation",
                        quantity=1.0,
                        unit_price=consult_price,
                        subtotal=consult_price,
                        tax_percent=5.0
                    )
                    db.add(consult_item)
                    bill_items.append(consult_item)
                    
                    # 2. Pharmacy (if enabled)
                    if s["enable_pharmacy"] and random.choice([True, False]):
                        pharm_price = float(random.choice([250.0, 450.0, 680.0]))
                        pharm_item = BillItem(
                            invoice_id=invoice.id,
                            item_name="Prescribed Outpatient Pharmacy Medication Split",
                            item_category="Pharmacy",
                            quantity=1.0,
                            unit_price=pharm_price,
                            subtotal=pharm_price,
                            tax_percent=12.0
                        )
                        db.add(pharm_item)
                        bill_items.append(pharm_item)
                        
                    # 3. Lab Test (if enabled)
                    if s["enable_labs"] and random.choice([True, False]):
                        lab_price = float(random.choice([600.0, 1200.0, 1800.0]))
                        lab_item = BillItem(
                            invoice_id=invoice.id,
                            item_name="Blood Panel Test (CBC, HbA1c, Renal Profile)",
                            item_category="Lab",
                            quantity=1.0,
                            unit_price=lab_price,
                            subtotal=lab_price,
                            tax_percent=18.0
                        )
                        db.add(lab_item)
                        bill_items.append(lab_item)
                        
                    # 4. Room Charge (only high-level or mid-level hospitals and occasionally)
                    if s["enable_inpatient_beds"] and random.choice([True, False, False, False]):
                        room_price = float(random.choice([1500.0, 3000.0, 5000.0]))
                        room_item = BillItem(
                            invoice_id=invoice.id,
                            item_name="General Semi-Private Room Ward Charge (1 Day)",
                            item_category="Room",
                            quantity=1.0,
                            unit_price=room_price,
                            subtotal=room_price,
                            tax_percent=12.0
                        )
                        db.add(room_item)
                        bill_items.append(room_item)
                    
                    await db.flush()
                    
                    # Compute Invoice totals
                    sub_total = sum(item.subtotal for item in bill_items)
                    tax_total = sum(item.subtotal * (item.tax_percent / 100.0) for item in bill_items)
                    total_amount = sub_total + tax_total
                    
                    invoice.total_amount = round(total_amount, 2)
                    invoice.discount_amount = 0.0
                    invoice.tax_amount = round(tax_total, 2)
                    invoice.payable_amount = round(total_amount, 2)
                    invoice.paid_amount = round(total_amount, 2)
                    await db.flush()
                    
                    # Create corresponding Payment
                    pay_method = random.choice([PaymentMethod.UPI, PaymentMethod.CARD, PaymentMethod.CASH])
                    txn_id = f"TXN-{pay_method.value}-{random.randint(1000000000, 9999999999)}-{random.randint(1000, 9999)}"
                    
                    payment = Payment(
                        patient_id=patient_obj.id,
                        hospital_id=hospital.id,
                        invoice_id=invoice.id,
                        amount=round(total_amount, 2),
                        currency="INR",
                        status=PaymentStatus.PAID,
                        payment_method=pay_method,
                        provider="Hospyn-Escrow",
                        provider_transaction_id=txn_id,
                        idempotency_key=f"IDEMP-{invoice.id}-{txn_id}",
                        metadata_json={
                            "escrow_routing": {
                                "status": "Routed_to_Owner",
                                "routed_at": (visit_time + timedelta(minutes=2)).isoformat(),
                                "hospital_owner_account_id": f"AC-{profile['short_code']}-OWNER-9988"
                            }
                        }
                    )
                    db.add(payment)
                    await db.flush()
                    
            print(f"[SEED] Successfully seeded: {profile['name']}")
            
        await db.commit()
        print("[SEED] DATABASE SEEDING COMPLETED SUCCESSFULLY WITH NO MOCK DATA ERRORS!")
        
    except Exception as e:
        await db.rollback()
        print(f"[SEED ERROR] Failed to seed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(seed_five_hospitals())
