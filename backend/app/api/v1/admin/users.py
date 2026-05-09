"""
Admin — إدارة المستخدمين
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_admin_user
from app.models.user import User, AccountStatus, UserPlan

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


class UpdateUserBody(BaseModel):
    status: Optional[str] = None
    plan:   Optional[str] = None
    role:   Optional[str] = None
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
