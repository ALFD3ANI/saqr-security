"""
Schemas التوثيق — تحقق من البيانات الداخلة والخارجة
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator, model_validator
from app.models.user import AccountStatus, UserPlan, UserRole
from app.core.security import validate_password_strength


# ── التسجيل ─────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    company_name: Optional[str] = None
    company_size: Optional[str] = None
    use_case: Optional[str] = None
    plan: UserPlan = UserPlan.FREE
    preferred_language: str = "ar"

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("الاسم يجب أن يكون حرفين على الأقل")
        if len(v) > 100:
            raise ValueError("الاسم طويل جداً")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = validate_password_strength(v)
        if errors:
            raise ValueError(" | ".join(errors))
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        digits = "".join(c for c in v if c.isdigit() or c == "+")
        if len(digits) < 9:
            raise ValueError("رقم الجوال غير صحيح")
        return v


# ── تسجيل الدخول ─────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    totp_code: Optional[str] = None  # كود 2FA لو مفعّل


class RefreshTokenRequest(BaseModel):
    refresh_token: str


# ── إعادة تعيين كلمة المرور ──────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        errors = validate_password_strength(v)
        if errors:
            raise ValueError(" | ".join(errors))
        return v


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        errors = validate_password_strength(v)
        if errors:
            raise ValueError(" | ".join(errors))
        return v


# ── 2FA ──────────────────────────────────────────────────────

class Enable2FARequest(BaseModel):
    totp_code: str  # يجب التحقق من الكود قبل التفعيل


class Verify2FARequest(BaseModel):
    totp_code: str


# ── الردود (Responses) ───────────────────────────────────────

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    phone: Optional[str]
    company_name: Optional[str]
    role: UserRole
    status: AccountStatus
    plan: UserPlan
    email_verified: bool
    totp_enabled: bool
    preferred_language: str
    plan_expires_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str
    message_ar: Optional[str] = None
    success: bool = True


class TotpSetupResponse(BaseModel):
    secret: str
    qr_uri: str
    message: str = "امسح الـ QR code بـ Google Authenticator"
