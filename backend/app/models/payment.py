from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Float, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id:          Mapped[int]   = mapped_column(Integer, primary_key=True)
    user_id:     Mapped[int]   = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # Moyasar details
    moyasar_id:  Mapped[Optional[str]] = mapped_column(String(255), nullable=True, unique=True, index=True)
    amount_sar:  Mapped[float]         = mapped_column(Float, default=0.0)
    amount_halala: Mapped[int]         = mapped_column(Integer, default=0)
    currency:    Mapped[str]           = mapped_column(String(10), default="SAR")

    # What they're paying for
    plan:        Mapped[str]   = mapped_column(String(50))
    billing:     Mapped[str]   = mapped_column(String(20))  # monthly / annual

    # Status: pending | paid | failed | refunded | expired
    status:      Mapped[str]   = mapped_column(String(30), default="pending", index=True)

    # Moyasar response payload (JSON)
    moyasar_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Invoice
    invoice_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    created_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
