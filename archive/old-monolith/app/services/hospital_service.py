from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.models import Hospital, Department, StaffProfile, User, RoleEnum
from app.schemas.hospital import HospitalCreate, DepartmentCreate
from fastapi import HTTPException
import logging

logger = logging.getLogger(__name__)

class HospitalService:
    """
    Enterprise Service Layer for Hospital Domain.
    Ensures strict transaction boundaries and business logic separation.
    """
    
    @staticmethod
    async def create_hospital(db: AsyncSession, hospital_data: HospitalCreate, admin_user_id: int) -> Hospital:
        """
        Creates a new tenant hospital and assigns the creator as the Hospital Admin.
        Enforces an atomic transaction boundary.
        """
        try:
            # Atomic transaction block
            async with db.begin_nested():
                # 1. Create Hospital
                new_hospital = Hospital(
                    name=hospital_data.name,
                    registration_number=hospital_data.registration_number,
                    subscription_status=hospital_data.subscription_status,
                    version_id=1
                )
                db.add(new_hospital)
                await db.flush() # Flush to get the hospital ID

                # 2. Update the User's Role to Hospital Admin
                result = await db.execute(select(User).where(User.id == admin_user_id).with_for_update())
                admin_user = result.scalar_one_or_none()
                if not admin_user:
                    raise HTTPException(status_code=404, detail="Admin user not found")
                
                admin_user.role = RoleEnum.hospital_admin
                
                # 3. Create StaffProfile mapping the user to this new tenant
                staff_profile = StaffProfile(
                    user_id=admin_user_id,
                    hospital_id=new_hospital.id,
                    role=RoleEnum.hospital_admin,
                    is_active=True
                )
                db.add(staff_profile)
            
            await db.commit()
            await db.refresh(new_hospital)
            
            # Emit Event (Transactional Outbox pattern would go here)
            logger.info(f"HOSPITAL_CREATED: tenant_id={new_hospital.id} by admin_id={admin_user_id}")
            
            return new_hospital
            
        except IntegrityError:
            await db.rollback()
            raise HTTPException(status_code=409, detail="Hospital registration number already exists")
        except Exception as e:
            await db.rollback()
            logger.error(f"Failed to create hospital: {str(e)}")
            raise e

    @staticmethod
    async def add_department(db: AsyncSession, hospital_id: int, dept_data: DepartmentCreate) -> Department:
        """
        Creates a new department (zone) within a hospital tenant.
        """
        try:
            async with db.begin_nested():
                new_dept = Department(
                    hospital_id=hospital_id,
                    name=dept_data.name
                )
                db.add(new_dept)
            await db.commit()
            await db.refresh(new_dept)
            return new_dept
        except Exception as e:
            await db.rollback()
            raise e
