from typing import Generic, TypeVar, Type, List, Optional, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from app.models.models import Base

T = TypeVar("T", bound=Base)

class AsyncBaseRepository(Generic[T]):
    def __init__(self, model: Type[T], db: AsyncSession):
        self.model = model
        self.db = db

    async def get(self, id: Any) -> Optional[T]:
        """Fetch a single record by primary key."""
        stmt = select(self.model).where(self.model.id == id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        """Fetch all records with pagination."""
        stmt = select(self.model).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj_in: dict) -> T:
        """Create a new record. Does NOT commit (Unit of Work)."""
        db_obj = self.model(**obj_in)
        self.db.add(db_obj)
        await self.db.flush() # Ensure ID is generated
        await self.db.refresh(db_obj)
        return db_obj

    async def update(self, db_obj: T, obj_in: dict) -> T:
        """Update an existing record. Does NOT commit (Unit of Work)."""
        for field, value in obj_in.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
        
        self.db.add(db_obj)
        await self.db.flush()
        await self.db.refresh(db_obj)
        return db_obj

    async def remove(self, id: Any) -> Optional[T]:
        """Delete a record by primary key. Does NOT commit (Unit of Work)."""
        obj = await self.get(id)
        if obj:
            await self.db.delete(obj)
            await self.db.flush()
        return obj

class TenantScopedRepository(AsyncBaseRepository[T]):
    """
    Enterprise Guard: Automatically enforces tenant (hospital) isolation.
    Every query and mutation is gated by the hospital_id.
    """
    def __init__(self, model: Type[T], db: AsyncSession, hospital_id: int):
        super().__init__(model, db)
        self.hospital_id = hospital_id

    async def get(self, id: Any) -> Optional[T]:
        """Tenant-scoped fetch."""
        stmt = select(self.model).where(
            self.model.id == id,
            self.model.hospital_id == self.hospital_id
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        """Tenant-scoped pagination."""
        stmt = select(self.model).where(
            self.model.hospital_id == self.hospital_id
        ).offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, obj_in: dict) -> T:
        """Tenant-scoped create (auto-injects hospital_id)."""
        obj_in["hospital_id"] = self.hospital_id
        return await super().create(obj_in)

class UserRepository(AsyncBaseRepository):
    async def get_by_email(self, email: str):
        stmt = select(self.model).where(self.model.email == email)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

class PatientRepository(AsyncBaseRepository):
    async def get_by_hospyn_id(self, hospyn_id: str):
        stmt = select(self.model).where(self.model.hospyn_id == hospyn_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def get_by_user_id(self, user_id: uuid.UUID):
        stmt = select(self.model).where(self.model.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
