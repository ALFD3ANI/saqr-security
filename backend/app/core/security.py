"""
طبقة الأمان: تشفير كلمات المرور، JWT tokens، 2FA
"""
import secrets
import string
from datetime import datetime, timedelta, timezone
from typing import Optional

import pyotp
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

# سياق تشفير كلمات المرور (bcrypt)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ── كلمات المرور ───────────────────────────────────────────────

def hash_password(password: str) -> str:
    """تشفير كلمة المرور قبل حفظها"""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """مقارنة كلمة المرور المدخلة مع المشفّرة"""
    return pwd_context.verify(plain, hashed)


def validate_password_strength(password: str) -> list[str]:
    """التحقق من قوة كلمة المرور، يرجع قائمة الأخطاء"""
    errors = []
    if len(password) < 8:
        errors.append("كلمة المرور يجب أن تكون 8 أحرف على الأقل")
    if not any(c.isupper() for c in password):
        errors.append("يجب أن تحتوي على حرف كبير")
    if not any(c.islower() for c in password):
        errors.append("يجب أن تحتوي على حرف صغير")
    if not any(c.isdigit() for c in password):
        errors.append("يجب أن تحتوي على رقم")
    return errors


# ── JWT Tokens ─────────────────────────────────────────────────

def create_access_token(user_id: int, email: str, role: str) -> str:
    """إنشاء Access Token (صالح لمدة قصيرة)"""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_EXPIRATION_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "email": email,
        "role": role,
        "type": "access",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: int) -> str:
    """إنشاء Refresh Token (صالح لأيام)"""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
        "iat": datetime.now(timezone.utc),
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    """فكّ تشفير الـ token وإرجاع بياناته، أو None لو انتهت صلاحيته"""
    try:
        return jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
    except JWTError:
        return None


# ── Tokens عشوائية (للتحقق وإعادة التعيين) ───────────────────

def generate_secure_token(length: int = 64) -> str:
    """رمز آمن عشوائي للـ email verification وإعادة تعيين كلمة المرور"""
    return secrets.token_urlsafe(length)


def generate_otp_code(length: int = 6) -> str:
    """رمز OTP رقمي لـ SMS"""
    return "".join(secrets.choice(string.digits) for _ in range(length))


# ── 2FA (TOTP — Google Authenticator) ────────────────────────

def generate_totp_secret() -> str:
    """إنشاء سر TOTP جديد للمستخدم"""
    return pyotp.random_base32()


def get_totp_uri(secret: str, email: str) -> str:
    """رابط QR code لـ Google Authenticator"""
    return pyotp.totp.TOTP(secret).provisioning_uri(
        name=email,
        issuer_name=settings.APP_NAME
    )


def verify_totp_code(secret: str, code: str) -> bool:
    """التحقق من رمز 2FA المدخل"""
    totp = pyotp.TOTP(secret)
    # valid_window=1: يقبل الرمز السابق والحالي والتالي (للتعويض عن فارق التوقيت)
    return totp.verify(code, valid_window=1)
