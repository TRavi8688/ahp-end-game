import pytest
from unittest.mock import AsyncMock, MagicMock
from app.repositories.base import AsyncBaseRepository
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Integer

class Base(DeclarativeBase):
    pass

class MockModel(Base):
    __tablename__ = "mock_model"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column()

@pytest.mark.asyncio
async def test_repository_get():
    """Verify that the AsyncBaseRepository correctly executes a select statement."""
    mock_db = AsyncMock(spec=AsyncSession)
    repo = AsyncBaseRepository(MockModel, mock_db)
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = MockModel(id=1)
    mock_db.execute.return_value = mock_result
    
    obj = await repo.get(1)
    
    assert obj is not None
    assert obj.id == 1
    assert mock_db.execute.called

@pytest.mark.asyncio
async def test_repository_create():
    """Verify that the repository correctly adds and commits new objects."""
    mock_db = AsyncMock(spec=AsyncSession)
    repo = AsyncBaseRepository(MockModel, mock_db)
    
    data = {"name": "Test Entry"}
    await repo.create(data)
    
    assert mock_db.add.called
    assert mock_db.flush.called
    assert mock_db.refresh.called
