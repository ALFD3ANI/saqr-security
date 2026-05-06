"""
FastAPI Dependencies — تُحقن في الـ endpoints
مثلاً: get_current_user تجلب المستخدم من الـ JWT
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import AccountStatus, User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """يجلب المستخدم الحالي من الـ JWT token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail={"error": "not_authenticated", "message": "يجب تسجيل الدخول أولاً"},
        headers={"WWW-Authenticate": "Bearer"},
    )

    if not credentials:
        raise credentials_exception

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise credentials_exception

    user_id = int(payload.get("sub", 0))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise credentials_exception

    return user


async def get_active_user(user: User = Depends(get_current_user)) -> User:
    """يتحقق إن الحساب مفعّل"""
    if user.status != AccountStatus.ACTIVE:
        status_messages = {
            AccountStatus.PENDING_APPROVAL: "حسابك قيد المراجعة، سيتم إشعارك قريباً",
            AccountStatus.SUSPENDED: "تم تعليق حسابك، تواصل مع الدعم",
            AccountStatus.BANNED: "تم حظر حسابك",
            AccountStatus.EXPIRED: "انتهت صلاحية اشتراكك، يرجى التجديد",
            AccountStatus.REJECTED: "تم رفض طلبك، تواصل مع الدعم",
        }
        detail = status_messages.get(user.status, "الحساب غير مفعّل")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "account_not_active", "message": detail},
        )

    # تحقق انتهاء الاشتراك
    if user.plan_expires_at and user.plan_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"error": "subscription_expired", "message": "انتهت صلاحية اشتراكك"},
        )

    return user


async def get_admin_user(user: User = Depends(get_active_user)) -> User:
    """يتحقق إن المستخدم أدمن"""
    if not user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "not_admin", "message": "غير مصرح لك بهذا الإجراء"},
        )
    return user


async def get_super_admin(user: User = Depends(get_admin_user)) -> User:
    """يتحقق إن المستخدم Super Admin"""
    if user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "not_super_admin", "message": "يتطلب صلاحية Super Admin"},
        )
    return user
