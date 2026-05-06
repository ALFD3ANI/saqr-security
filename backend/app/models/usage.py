from datetime import date, datetime
from typing import Optional
from sqlalchemy import Integer, Float, Date, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base


class UserUsage(Base):
    """استهلاك كل مستخدم — يُحدَّث بعد كل عملية"""
    __tablename__ = "user_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "year", "month", name="uq_user_usage_month"),
    )

    id:      Mapped[int]   = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int]   = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    year:    Mapped[int]   = mapped_column(Integer, nullable=False)
    month:   Mapped[int]   = mapped_column(Integer, nullable=False)

    # فحوصات
    url_scans:    Mapped[int] = mapped_column(Integer, default=0)
    file_scans:   Mapped[int] = mapped_column(Integer, default=0)
    apk_scans:    Mapped[int] = mapped_column(Integer, default=0)
    api_scans:    Mapped[int] = mapped_column(Integer, default=0)
    domain_scans: Mapped[int] = mapped_column(Integer, default=0)
    github_scans: Mapped[int] = mapped_column(Integer, default=0)
    email_scans:  Mapped[int] = mapped_column(Integer, default=0)
    cloud_scans:  Mapped[int] = mapped_column(Integer, default=0)

    # AI
    ai_chat_messages: Mapped[int]   = mapped_column(Integer, default=0)
    ai_search_queries:Mapped[int]   = mapped_column(Integer, default=0)
    ai_input_tokens:  Mapped[int]   = mapped_column(Integer, default=0)
    ai_output_tokens: Mapped[int]   = mapped_column(Integer, default=0)
    ai_cost_usd:      Mapped[float] = mapped_column(Float,   default=0.0)
    cache_hits:       Mapped[int]   = mapped_column(Integer, default=0)
    cache_savings_usd:Mapped[float] = mapped_column(Float,   default=0.0)

    # تقارير
    pdf_reports: Mapped[int] = mapped_column(Integer, default=0)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def total_scans(self) -> int:
        return (self.url_scans + self.file_scans + self.apk_scans +
                self.api_scans + self.domain_scans + self.github_scans +
                self.email_scans + self.cloud_scans)


class DailyUsage(Base):
    """استهلاك يومي — للحدود اليومية"""
    __tablename__ = "daily_usage"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_daily_usage"),
    )

    id:         Mapped[int]  = mapped_column(Integer, primary_key=True)
    user_id:    Mapped[int]  = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    scans:            Mapped[int] = mapped_column(Integer, default=0)
    ai_chat_messages: Mapped[int] = mapped_column(Integer, default=0)
    ai_search_queries:Mapped[int] = mapped_column(Integer, default=0)
