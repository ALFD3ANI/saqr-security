"""
Admin Dashboard — إحصائيات شاملة للمنصة
"""
from datetime import datetime, timezone, timedelta, date
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_admin_user
from app.models.user import User, AccountStatus, UserPlan
from app.models.approval_request import ApprovalRequest
from app.models.usage import UserUsage, DailyUsage
from app.models.subscription import Subscription

router = APIRouter(prefix="/admin/dashboard", tags=["Admin"])


@router.get("/stats")
async def get_dashboard_stats(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    today = date.today()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── إجمالي المستخدمين ───────────────────────────────────
    total_users = await db.scalar(select(func.count(User.id)))
    active_users = await db.scalar(
        select(func.count(User.id)).where(User.status == AccountStatus.ACTIVE)
    )
    pending_approvals = await db.scalar(
        select(func.count(ApprovalRequest.id))
        .where(ApprovalRequest.status == "pending")
    )

    # ── توزيع الخطط ─────────────────────────────────────────
    plan_dist_rows = await db.execute(
        select(User.plan, func.count(User.id))
        .where(User.status == AccountStatus.ACTIVE)
        .group_by(User.plan)
    )
    plan_distribution = {str(row[0].value if hasattr(row[0], 'value') else row[0]): row[1]
                         for row in plan_dist_rows}

    # ── تسجيلات اليوم ───────────────────────────────────────
    new_today = await db.scalar(
        select(func.count(User.id))
        .where(func.date(User.created_at) == today)
    )

    # ── إيرادات الشهر ───────────────────────────────────────
    from app.api.v1.subscriptions import PLAN_PRICES
    monthly_prices = {k: v["monthly"] for k, v in PLAN_PRICES.items()}
    mrr = sum(monthly_prices.get(str(plan), 0) * count for plan, count in plan_distribution.items())

    # ── استهلاك AI اليوم ────────────────────────────────────
    ai_cost_today = await db.scalar(
        select(func.coalesce(func.sum(DailyUsage.ai_chat_messages), 0))
        .where(DailyUsage.usage_date == today)
    ) or 0

    # ── إجمالي الفحوصات هذا الشهر ───────────────────────────
    monthly_scans_total = await db.scalar(
        select(
            func.coalesce(
                func.sum(
                    UserUsage.url_scans + UserUsage.file_scans + UserUsage.apk_scans +
                    UserUsage.api_scans + UserUsage.domain_scans + UserUsage.github_scans
                ), 0
            )
        ).where(
            UserUsage.year == now.year,
            UserUsage.month == now.month,
        )
    ) or 0

    # ── الطلبات المعلّقة الأخيرة ────────────────────────────
    pending_rows = await db.execute(
        select(ApprovalRequest)
        .where(ApprovalRequest.status == "pending")
        .order_by(ApprovalRequest.created_at.desc())
        .limit(5)
    )
    recent_pending = [
        {
            "id": r.id,
            "full_name": r.full_name,
            "email": r.email,
            "plan": r.requested_plan,
            "risk_score": r.risk_score,
            "risk_level": r.risk_level,
            "risk_flags": r.risk_flags,
            "created_at": r.created_at.isoformat(),
        }
        for r in pending_rows.scalars()
    ]

    return {
        "users": {
            "total": total_users,
            "active": active_users,
            "pending_approvals": pending_approvals,
            "new_today": new_today,
        },
        "plans": plan_distribution,
        "revenue": {
            "mrr_sar": mrr,
            "arr_sar": mrr * 12,
        },
        "ai": {
            "messages_today": ai_cost_today,
        },
        "scans": {
            "this_month": monthly_scans_total,
        },
        "recent_pending": recent_pending,
    }
