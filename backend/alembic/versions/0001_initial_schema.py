"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-01-01 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tables are created by SQLAlchemy's create_all on startup.
    # This migration is a no-op placeholder so Alembic has a base revision
    # when running `alembic upgrade head` on a fresh database.
    pass


def downgrade() -> None:
    pass
