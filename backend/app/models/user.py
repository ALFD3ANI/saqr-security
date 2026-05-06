"""
نموذج المستخدم — يخزّن كل بيانات الحساب والاشتراك
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, Text, Integer, Float, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
import enum

from app.core.database import Base


class AccountStatus(str, enum.Enum):
    PENDING_PAYMENT  = "pending_payment"   # سجّل لكن ما دفع
    PENDING_APPROVAL = "pending_approval"  # دفع وينتظر موافقة الأدمن
    ACTIVE           = "active"            # مفعّل ونشط
    SUSPENDED        = "suspended"         # معلق
    BANNED           = "banned"            # محظور نهائياً
    EXPIRED          = "expired"           # انتهى الاشتراك
    REJECTED         = "rejected"          # مرفوض من الأدمن
    CANCELLED        = "cancelled"         # ألغى المستخدم


class UserPlan(str, enum.Enum):
    FREE         = "free"
    STARTER      = "starter"
    PROFESSIONAL = "professional"
    BUSINESS     = "business"
    ENTERPRISE   = "enterprise"


class UserRole(str, enum.Enum):
    USER  = "user"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"


class User(Base):
    __tablename__ = "users"

    # ── الهوية ─────────────────────────────────────────────────
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    # ── المعلومات الشخصية ───────────────────────────────────────
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    company_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    company_size: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    use_case: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # ── الدور والحالة ───────────────────────────────────────────
    role: Mapped[UserRole] = mapped_column(
        SAEnum(UserRole), default=UserRole.USER, nullable=False
    )
    status: Mapped[AccountStatus] = mapped_column(
        SAEnum(AccountStatus), default=AccountStatus.PENDING_PAYMENT, nullable=False
    )

    # ── الاشتراك ────────────────────────────────────────────────
    plan: Mapped[UserPlan] = mapped_column(
        SAEnum(UserPlan), default=UserPlan.FREE, nullable=False
    )
    plan_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    trial_ends_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── التحقق ─────────────────────────────────────────────────
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verify_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email_verify_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── إعادة تعيين كلمة المرور ─────────────────────────────────
    password_reset_token: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    password_reset_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── المصادقة الثنائية (2FA) ─────────────────────────────────
    totp_secret: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    totp_enabled: Mapped[bool] = mapped_column(Boolean, default=False)

    # ── الأمان والتتبع ──────────────────────────────────────────
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    last_login_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # ── التفضيلات ───────────────────────────────────────────────
    preferred_language: Mapped[str] = mapped_column(String(5), default="ar")

    # ── التواريخ ────────────────────────────────────────────────
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email} plan={self.plan} status={self.status}>"

    @property
    def is_active(self) -> bool:
        return self.status == AccountStatus.ACTIVE

    @property
    def is_admin(self) -> bool:
        return self.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)

    @property
    def display_name(self) -> str:
        return self.full_name or self.email.split("@")[0]
