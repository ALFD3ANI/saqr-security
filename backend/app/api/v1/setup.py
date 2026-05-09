"""
نقطة نهاية لإنشاء حساب المالك الأول (SUPER_ADMIN) — تعمل مرة واحدة فقط
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import hash_password
from app.models.user import User, AccountStatus, UserPlan, UserRole

router = APIRouter(prefix="/setup", tags=["Setup"])


class FirstAdminBody(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    company_name: str | None = None


@router.post("/first-admin")
async def create_first_admin(
    body: FirstAdminBody,
    db: AsyncSession = Depends(get_db),
):
    """
    ينشئ حساب SUPER_ADMIN الأول — يعمل فقط إذا لا يوجد أي SUPER_ADMIN في قاعدة البيانات.
    بعد الإنشاء يصبح هذا الـ endpoint معطّلاً تلقائياً.
    """
    count = await db.scalar(
        select(func.count(User.id)).where(User.role == UserRole.SUPER_ADMIN)
    )
    if count and count > 0:
        raise HTTPException(
            403,
            detail={"message": "يوجد SUPER_ADMIN بالفعل — هذا الإعداد تم مسبقاً"},
        )

    existing = await db.scalar(select(User.id).where(User.email == body.email.lower()))
    if existing:
        raise HTTPException(409, detail={"message": "الإيميل مستخدم بالفعل"})

    owner = User(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        company_name=body.company_name,
        role=UserRole.SUPER_ADMIN,
        status=AccountStatus.ACTIVE,
        plan=UserPlan.ENTERPRISE,
        email_verified=True,
        totp_enabled=False,
        failed_login_attempts=0,
        preferred_language="ar",
    )
    db.add(owner)
    await db.commit()
    await db.refresh(owner)

    return {
        "success": True,
        "message": "تم إنشاء حساب المالك بنجاح. احذف أو عطّل هذا الـ endpoint الآن.",
        "id": owner.id,
        "email": owner.email,
        "role": owner.role.value,
    }
