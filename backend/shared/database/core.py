from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
import os

Base = declarative_base()


def get_engine(database_url: str):
    return create_async_engine(
        database_url, pool_size=10, max_overflow=20, pool_pre_ping=True
    )


def get_session_maker(engine):
    return async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
