"""
Admin — إدارة المستخدمين
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, EmailStr
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_admin_user, get_super_admin
from app.core.security import hash_password
from app.models.user import User, AccountStatus, UserPlan, UserRole

router = APIRouter(prefix="/admin/users", tags=["Admin"])


@router.get("/")
async def list_users(
    search: Optional[str]  = Query(None),
    status: Optional[str]  = Query(None),
    plan:   Optional[str]  = Query(None),
    limit:  int = Query(50, le=200),
    offset: int = Query(0),
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(User).order_by(User.created_at.desc())

    if search:
        q = q.where(or_(
            User.email.ilike(f"%{search}%"),
            User.full_name.ilike(f"%{search}%"),
            User.company_name.ilike(f"%{search}%"),
        ))
    if status:
        q = q.where(User.status == status)
    if plan:
        q = q.where(User.plan == plan)

    total = await db.scalar(
        select(func.count(User.id)).where(
            *([User.status == status] if status else []),
            *([User.plan == plan] if plan else []),
        )
    ) or 0

    rows = await db.execute(q.offset(offset).limit(limit))
    users = rows.scalars().all()

    return {
        "total": total,
        "users": [_serialize(u) for u in users],
    }


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, detail={"message": "المستخدم غير موجود"})
    return _serialize(user)


class CreateAdminBody(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "ADMIN"        # ADMIN | SUPER_ADMIN
    plan: str = "ENTERPRISE"
    company_name: Optional[str] = None
    phone: Optional[str] = None


@router.post("/create-admin")
async def create_admin_account(
    body: CreateAdminBody,
    admin=Depends(get_super_admin),   # SUPER_ADMIN فقط
    db: AsyncSession = Depends(get_db),
):
    """إنشاء حساب أدمن مباشرة — SUPER_ADMIN فقط"""
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(409, detail={"message": "الإيميل مستخدم بالفعل"})

    try:
        role = UserRole(body.role)
    except ValueError:
        raise HTTPException(400, detail={"message": f"رتبة غير صالحة: {body.role}. المتاح: ADMIN, SUPER_ADMIN"})

    try:
        plan = UserPlan(body.plan)
    except ValueError:
        plan = UserPlan.ENTERPRISE

    new_admin = User(
        email=body.email.lower(),
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        phone=body.phone,
        company_name=body.company_name,
        role=role,
        status=AccountStatus.ACTIVE,
        plan=plan,
        email_verified=True,
        totp_enabled=False,
        failed_login_attempts=0,
        preferred_language="ar",
    )
    db.add(new_admin)
    await db.commit()
    await db.refresh(new_admin)
    return {"success": True, "user": _serialize(new_admin)}


class SetRoleBody(BaseModel):
    role: str   # USER | ADMIN | SUPER_ADMIN


@router.post("/{user_id}/set-role")
async def set_user_role(
    user_id: int,
    body: SetRoleBody,
    admin=Depends(get_super_admin),   # SUPER_ADMIN فقط
    db: AsyncSession = Depends(get_db),
):
    """تغيير رتبة المستخدم — SUPER_ADMIN فقط"""
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, detail={"message": "المستخدم غير موجود"})
    if user.id == admin.id:
        raise HTTPException(400, detail={"message": "لا تقدر تغيير رتبتك الخاصة"})

    try:
        user.role = UserRole(body.role)
    except ValueError:
        raise HTTPException(400, detail={"message": f"رتبة غير صالحة: {body.role}"})

    await db.commit()
    return {"success": True, "message": f"تم تغيير الرتبة إلى {body.role}", "user": _serialize(user)}


class UpdateUserBody(BaseModel):
    status: Optional[str] = None
    plan:   Optional[str] = None
    notes:  Optional[str] = None


@router.patch("/{user_id}")
async def update_user(
    user_id: int,
    body: UpdateUserBody,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, detail={"message": "المستخدم غير موجود"})

    if body.status:
        try:
            user.status = AccountStatus(body.status)
        except ValueError:
            raise HTTPException(400, detail={"message": f"حالة غير صالحة: {body.status}"})

    if body.plan:
        try:
            user.plan = UserPlan(body.plan)
        except ValueError:
            raise HTTPException(400, detail={"message": f"خطة غير صالحة: {body.plan}"})

    await db.commit()
    return {"success": True, "user": _serialize(user)}


@router.post("/{user_id}/suspend")
async def suspend_user(
    user_id: int,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    user.status = AccountStatus.SUSPENDED
    await db.commit()
    return {"success": True, "message": "تم تعليق الحساب"}


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: int,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    user.status = AccountStatus.ACTIVE
    await db.commit()
    return {"success": True, "message": "تم تفعيل الحساب"}


@router.post("/{user_id}/ban")
async def ban_user(
    user_id: int,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404)
    user.status = AccountStatus.BANNED
    await db.commit()
    return {"success": True, "message": "تم حظر الحساب"}


def _serialize(u: User) -> dict:
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "phone": u.phone,
        "company_name": u.company_name,
        "role": str(u.role.value if hasattr(u.role, 'value') else u.role),
        "status": str(u.status.value if hasattr(u.status, 'value') else u.status),
        "plan": str(u.plan.value if hasattr(u.plan, 'value') else u.plan),
        "email_verified": u.email_verified,
        "totp_enabled": u.totp_enabled,
        "last_login_at": u.last_login_at.isoformat() if u.last_login_at else None,
        "last_login_ip": u.last_login_ip,
        "plan_expires_at": u.plan_expires_at.isoformat() if u.plan_expires_at else None,
        "created_at": u.created_at.isoformat(),
    }
