import asyncio
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.models import Patient
from sqlalchemy import select as sa_select

async def run():
    engine = create_async_engine('postgresql+asyncpg://postgres:12345678@34.143.73.2:5432/hospyn?ssl=require')
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        prescription_in_patient_id = 'Hospyn-D0AAB75D'
        try:
            if prescription_in_patient_id:
                try:
                    final_patient_id = uuid.UUID(prescription_in_patient_id)
                    print('UUID worked')
                except ValueError:
                    print('Trying Hospyn ID')
                    stmt_p = sa_select(Patient).where(Patient.hospyn_id == prescription_in_patient_id)
                    patient_res = await db.execute(stmt_p)
                    patient_obj = patient_res.scalars().first()
                    if patient_obj:
                        print('Found:', patient_obj.id)
                    else:
                        print('Not found')
        except Exception as e:
            print('EXCEPTION:', type(e), e)

asyncio.run(run())
