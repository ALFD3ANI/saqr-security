from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Float, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base


class Subscription(Base):
    """سجل الاشتراكات — كل ترقية أو تغيير خطة"""
    __tablename__ = "subscriptions"

    id:      Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    plan:       Mapped[str]   = mapped_column(String(50), nullable=False)
    prev_plan:  Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    amount_sar: Mapped[float] = mapped_column(Float, default=0.0)
    billing:    Mapped[str]   = mapped_column(String(10), default="monthly")  # monthly / annual

    status:     Mapped[str]   = mapped_column(String(30), default="active")
    payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    starts_at:  Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class TopUp(Base):
    """إضافات مشتراة فوق الخطة الأساسية"""
    __tablename__ = "topups"

    id:      Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    type:       Mapped[str]   = mapped_column(String(50))   # ai_messages, scans, websites
    quantity:   Mapped[int]   = mapped_column(Integer)
    used:       Mapped[int]   = mapped_column(Integer, default=0)
    amount_sar: Mapped[float] = mapped_column(Float)
    payment_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    @property
    def remaining(self) -> int:
        return max(0, self.quantity - self.used)
