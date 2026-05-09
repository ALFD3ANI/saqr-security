"""Alembic env.py — يربط migrations بـ SQLAlchemy models"""
import os
import sys
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# أضف مجلد app للـ path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings
import app.models  # noqa — import all models so autogenerate sees them
from app.core.database import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def get_sync_url() -> str:
    """Convert async URL to sync for Alembic (uses psycopg2 not asyncpg)"""
    url = settings.DATABASE_URL
    # postgres:// → postgresql://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    # postgresql+asyncpg:// → postgresql://
    if url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql+asyncpg://", "postgresql://", 1)
    # Dev: use SQLite
    if url.startswith("postgresql") and settings.APP_ENV == "development":
        db_path = os.path.join(os.path.dirname(__file__), "..", "saqr_dev.db")
        return f"sqlite:///{os.path.abspath(db_path)}"
    return url


def run_migrations_offline() -> None:
    url = get_sync_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,   # SQLite compatibility
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    from sqlalchemy import create_engine
    url = get_sync_url()
    connectable = create_engine(url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
