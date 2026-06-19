from sqlalchemy.ext.asyncio import AsyncSession
from typing import TypeVar, Generic, Type, Optional, List, Any
from sqlalchemy import select, update, delete

T = TypeVar("T")

class BaseService(Generic[T]):
    """
    Enterprise Base Service providing common CRUD operations with 
    transactional integrity and strict type safety.
    """
    def __init__(self, model: Optional[Type[T]] = None, db: Optional[AsyncSession] = None):
        self.model = model
        self.db = db

    async def get(self, id: Any) -> Optional[T]:
        return await self.db.get(self.model, id)

    async def get_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        result = await self.db.execute(select(self.model).offset(skip).limit(limit))
        return result.scalars().all()

    async def create(self, **kwargs) -> T:
        obj = self.model(**kwargs)
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def update(self, id: Any, **kwargs) -> Optional[T]:
        obj = await self.get(id)
        if not obj:
            return None
        for key, value in kwargs.items():
            setattr(obj, key, value)
        await self.db.flush()
        return obj

    async def delete(self, id: Any) -> bool:
        obj = await self.get(id)
        if not obj:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True
