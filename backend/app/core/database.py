"""
الاتصال بقاعدة البيانات
- بيئة التطوير: SQLite (بدون تثبيت)
- بيئة الإنتاج: PostgreSQL
"""
import os
from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.core.config import settings


def _build_db_url() -> str:
    url = settings.DATABASE_URL
    # Supabase/Render give postgres:// or postgresql:// → convert for asyncpg
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    # Dev: use SQLite when no real PostgreSQL is configured
    if url.startswith("postgresql") and settings.APP_ENV == "development":
        db_path = os.path.join(os.path.dirname(__file__), "..", "..", "saqr_dev.db")
        db_path = os.path.abspath(db_path)
        return f"sqlite+aiosqlite:///{db_path}"
    return url


DB_URL = _build_db_url()

# SQLite لا يدعم pool_size/max_overflow
_is_sqlite = DB_URL.startswith("sqlite")

_engine_kwargs: dict = {}
if not _is_sqlite:
    _engine_kwargs = {
        "pool_pre_ping": True,
        "pool_size": 5,
        "max_overflow": 10,
        "connect_args": {"ssl": None},
    }

engine = create_async_engine(
    DB_URL,
    echo=settings.APP_ENV == "development",
    **_engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
