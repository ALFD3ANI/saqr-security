"""
Admin — إدارة طلبات التفعيل
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_admin_user
from app.core.approval_workflow import process_approval_decision
from app.models.approval_request import ApprovalRequest
from app.models.user import User

router = APIRouter(prefix="/admin/approvals", tags=["Admin"])


@router.get("/")
async def list_approvals(
    status: Optional[str] = Query("pending"),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """قائمة طلبات التفعيل"""
    q = select(ApprovalRequest).order_by(ApprovalRequest.created_at.desc())
    if status and status != "all":
        q = q.where(ApprovalRequest.status == status)
    q = q.offset(offset).limit(limit)

    rows = await db.execute(q)
    requests = rows.scalars().all()

    # عدد الإجمالي
    from sqlalchemy import func
    count_q = select(func.count(ApprovalRequest.id))
    if status and status != "all":
        count_q = count_q.where(ApprovalRequest.status == status)
    total = await db.scalar(count_q) or 0

    return {
        "total": total,
        "requests": [
            {
                "id": r.id,
                "user_id": r.user_id,
                "full_name": r.full_name,
                "email": r.email,
                "phone": r.phone,
                "company_name": r.company_name,
                "use_case": r.use_case,
                "requested_plan": r.requested_plan,
                "payment_amount": r.payment_amount,
                "payment_status": r.payment_status,
                "ip_address": r.ip_address,
                "country": r.country,
                "risk_score": r.risk_score,
                "risk_level": r.risk_level,
                "risk_flags": r.risk_flags,
                "status": r.status,
                "admin_notes": r.admin_notes,
                "rejection_reason": r.rejection_reason,
                "created_at": r.created_at.isoformat(),
                "approved_at": r.approved_at.isoformat() if r.approved_at else None,
            }
            for r in requests
        ],
    }


class ApprovalDecision(BaseModel):
    decision: str           # "approve" | "reject"
    notes: Optional[str] = None
    rejection_reason: Optional[str] = None


@router.post("/{request_id}/decide")
async def decide_approval(
    request_id: int,
    body: ApprovalDecision,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """الموافقة أو رفض طلب تفعيل"""
    if body.decision not in ("approve", "reject"):
        raise HTTPException(400, detail={"message": "القرار يجب أن يكون approve أو reject"})

    req = await db.get(ApprovalRequest, request_id)
    if not req:
        raise HTTPException(404, detail={"message": "الطلب غير موجود"})
    if req.status != "pending":
        raise HTTPException(400, detail={"message": f"الطلب بالفعل {req.status}"})

    user = await db.get(User, req.user_id)
    if not user:
        raise HTTPException(404, detail={"message": "المستخدم غير موجود"})

    await process_approval_decision(
        db=db, req=req, user=user,
        decision=body.decision,
        admin_id=admin.id,
        notes=body.notes,
        rejection_reason=body.rejection_reason,
    )
    await db.commit()

    return {
        "success": True,
        "message": "تمت الموافقة بنجاح" if body.decision == "approve" else "تم الرفض",
        "request_id": request_id,
        "new_status": req.status,
        "user_status": str(user.status.value if hasattr(user.status, 'value') else user.status),
    }


@router.get("/{request_id}")
async def get_approval_detail(
    request_id: int,
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """تفاصيل طلب تفعيل واحد"""
    req = await db.get(ApprovalRequest, request_id)
    if not req:
        raise HTTPException(404, detail={"message": "الطلب غير موجود"})

    user = await db.get(User, req.user_id)
    return {
        "request": {
            "id": req.id,
            "status": req.status,
            "risk_score": req.risk_score,
            "risk_level": req.risk_level,
            "risk_flags": req.risk_flags,
            "requested_plan": req.requested_plan,
            "payment_amount": req.payment_amount,
            "ip_address": req.ip_address,
            "country": req.country,
            "user_agent": req.user_agent,
            "admin_notes": req.admin_notes,
            "rejection_reason": req.rejection_reason,
            "created_at": req.created_at.isoformat(),
        },
        "user": {
            "id": user.id if user else None,
            "full_name": req.full_name,
            "email": req.email,
            "phone": req.phone,
            "company_name": req.company_name,
            "company_size": req.company_size,
            "use_case": req.use_case,
            "status": str(user.status.value if user and hasattr(user.status, 'value') else ""),
            "created_at": user.created_at.isoformat() if user else None,
        },
    }
