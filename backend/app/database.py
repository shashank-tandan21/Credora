from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import get_settings


settings = get_settings()
engine = (
    create_async_engine(settings.database_url, pool_pre_ping=True)
    if settings.database_url
    else None
)
session_factory = (
    async_sessionmaker(engine, expire_on_commit=False)
    if engine is not None
    else None
)


async def get_db_session() -> AsyncIterator[AsyncSession]:
    if session_factory is None:
        raise RuntimeError("Database sessions are unavailable while DEMO_MODE=true.")
    async with session_factory() as session:
        yield session


async def check_database_connection() -> bool:
    if engine is None:
        return False
    async with engine.connect() as connection:
        await connection.exec_driver_sql("SELECT 1")
    return True
