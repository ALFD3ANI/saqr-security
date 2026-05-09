from datetime import datetime
from typing import Optional
from sqlalchemy import Integer, Float, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from app.core.database import Base


class AIConversation(Base):
    __tablename__ = "ai_conversations"

    id:      Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True)

    title:      Mapped[str]           = mapped_column(String(255), default="محادثة جديدة")
    model_used: Mapped[str]           = mapped_column(String(50), default="haiku")
    messages:   Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON list

    # إحصائيات تكلفة
    total_input_tokens:  Mapped[int]   = mapped_column(Integer, default=0)
    total_output_tokens: Mapped[int]   = mapped_column(Integer, default=0)
    total_cost_usd:      Mapped[float] = mapped_column(Float, default=0.0)
    message_count:       Mapped[int]   = mapped_column(Integer, default=0)

    # مرتبط باختياري بفحص
    scan_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("scans.id", ondelete="SET NULL"), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
