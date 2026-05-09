import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.models import User, Patient, Doctor, DoctorAccess, Allergy, MedicalRecord, QueueEntry
from app.core.security import get_password_hash
from sqlalchemy import func

async def seed_data():
    db = AsyncSessionLocal()
    try:
        # 1. Ensure Demo Doctor Exists
        res_dr = await db.execute(select(User).where(User.email == 'dr.test@hospyn.local'))
        dr_user = res_dr.scalars().first()
        if not dr_user:
            dr_user = User(
                email='dr.test@hospyn.local',
                hashed_password=get_password_hash('doctor123'),
                first_name='Gaurav',
                last_name='Sharma',
                role='doctor',
                is_active=True
            )
            db.add(dr_user)
            await db.commit()
        
        res_profile = await db.execute(select(Doctor).where(Doctor.user_id == dr_user.id))

        # 2. Create Multiple Patients
        patients_data = [
            {'email': 'rahul.s@hospyn.test', 'fn': 'Rahul', 'ln': 'Sharma', 'hospyn': 'Hospyn-IN-9284-7731', 'dob': '1990-05-15', 'phone': '+919876543210'},
            {'email': 'priya.k@hospyn.test', 'fn': 'Priya', 'ln': 'Kapoor', 'hospyn': 'Hospyn-IN-8222-7215-TP', 'dob': '1995-08-22', 'phone': '+919876543211'},
            {'email': 'amit.v@hospyn.test', 'fn': 'Amit', 'ln': 'Verma', 'hospyn': 'Hospyn-TEST-DRIVE', 'dob': '1978-12-01', 'phone': '+919876543212'},
            {'email': 'sara.j@hospyn.test', 'fn': 'Sara', 'ln': 'Jones', 'hospyn': 'Hospyn-EXT-101', 'dob': '1992-03-30', 'phone': '+919876543213'}
        ]

        for p_info in patients_data:
            res_p = await db.execute(select(User).where(User.email == p_info['email']))
            u = res_p.scalars().first()
            if not u:
                u = User(
                    email=p_info['email'],
                    hashed_password=get_password_hash('password123'),
                    first_name=p_info['fn'],
                    last_name=p_info['ln'],
                    role='patient',
                    is_active=True
                )
                db.add(u)
                await db.commit()
                await db.refresh(u)
            
            res_pp = await db.execute(select(Patient).where(Patient.hospyn_id == p_info['hospyn']))
            patient = res_pp.scalars().first()
            if not patient:
                patient = Patient(
                    user_id=u.id,
                    hospyn_id=p_info['hospyn'],
                    date_of_birth=p_info['dob'],
                    phone_number=p_info['phone'],
                    blood_group=random.choice(['A+', 'B+', 'O+', 'AB+']),
                    gender=random.choice(['Male', 'Female'])
                )
                db.add(patient)
                await db.commit()
                await db.refresh(patient)
            else:
                # Update existing patient user_id if needed
                patient.user_id = u.id
                await db.commit()

            # 3. Add Allergies
            res_all = await db.execute(select(Allergy).where(Allergy.patient_id == patient.id))
            if not res_all.scalars().first():
                db.add(Allergy(patient_id=patient.id, allergen='Penicillin', severity='Severe', added_by='system'))
                if p_info['ln'] == 'Verma':
                    db.add(Allergy(patient_id=patient.id, allergen='Peanuts', severity='Moderate', added_by='system'))
            
            # 4. Add Medical Records
            res_rec = await db.execute(select(MedicalRecord).where(MedicalRecord.patient_id == patient.id))
            if not res_rec.scalars().first():
                for i in range(3):
                    db.add(MedicalRecord(
                        patient_id=patient.id,
                        type='document',
                        file_url=f"https://example.com/reports/demo_{random.randint(100, 999)}.pdf",
                        ai_summary="Patient shows stable vitals. No acute findings on last scan.",
                        created_at=datetime.now() - timedelta(days=random.randint(10, 100))
                    )
                )

            # 5. Add Recent Doctor Access
            res_acc = await db.execute(select(DoctorAccess).where(
                DoctorAccess.patient_id == patient.id,
                DoctorAccess.doctor_user_id == dr_user.id
            ))
            if not res_acc.scalars().first():
                db.add(DoctorAccess(
                    patient_id=patient.id,
                    doctor_user_id=dr_user.id,
                    doctor_name=f"Dr. {dr_user.last_name}",
                    clinic_name="Hospyn Clinical Hub",
                    access_level="full",
                    status="granted"
                ))
        
        await db.commit()
        print("✅ Database Seeded with Million-Dollar clinical data!")

    except Exception as e:
        print(f"❌ Seeding Error: {e}")
        await db.rollback()
    finally:
        await db.close()

if __name__ == "__main__":
    asyncio.run(seed_data())
