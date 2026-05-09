from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Float, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id:      Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    # بيانات الطلب
    requested_plan: Mapped[str]          = mapped_column(String(50))
    payment_id:     Mapped[Optional[str]]= mapped_column(String(255), nullable=True)
    payment_amount: Mapped[float]        = mapped_column(Float, default=0.0)
    payment_status: Mapped[str]          = mapped_column(String(30), default="pending")

    # بيانات المستخدم (نسخة وقت الطلب)
    full_name:    Mapped[str]           = mapped_column(String(255))
    email:        Mapped[str]           = mapped_column(String(255))
    phone:        Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_size: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    use_case:     Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # بيانات الأمان
    ip_address:  Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    country:     Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    user_agent:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # تقييم المخاطر (يُحسب تلقائياً)
    risk_score: Mapped[int]          = mapped_column(Integer, default=0)
    risk_flags: Mapped[Optional[str]]= mapped_column(Text, nullable=True)  # JSON list كـ string

    # قرار الإدارة
    status:           Mapped[str]           = mapped_column(String(30), default="pending", index=True)
    admin_notes:      Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    approved_by:      Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at:      Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    @property
    def risk_level(self) -> str:
        if self.risk_score <= 30:  return "low"
        if self.risk_score <= 60:  return "medium"
        if self.risk_score <= 85:  return "high"
        return "critical"
