from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Float, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base


class Scan(Base):
    __tablename__ = "scans"

    id:      Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    scan_type: Mapped[str] = mapped_column(String(30), index=True)  # url|file|apk|api|domain|github|email
    target:    Mapped[str] = mapped_column(Text)                    # URL, domain, file path, etc.
    target_display: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # نتائج
    status:     Mapped[str]   = mapped_column(String(20), default="queued", index=True)  # queued|running|completed|failed
    risk_score: Mapped[int]   = mapped_column(Integer, default=0)
    risk_level: Mapped[str]   = mapped_column(String(20), default="unknown")  # low|medium|high|critical
    findings:   Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # JSON list
    summary:    Mapped[Optional[str]] = mapped_column(Text, nullable=True)   # JSON summary object
    error_msg:  Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # إحصائيات سريعة
    total_findings:    Mapped[int] = mapped_column(Integer, default=0)
    critical_count:    Mapped[int] = mapped_column(Integer, default=0)
    high_count:        Mapped[int] = mapped_column(Integer, default=0)
    medium_count:      Mapped[int] = mapped_column(Integer, default=0)
    low_count:         Mapped[int] = mapped_column(Integer, default=0)
    info_count:        Mapped[int] = mapped_column(Integer, default=0)

    # توقيت
    started_at:   Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    duration_ms:  Mapped[Optional[int]]      = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
