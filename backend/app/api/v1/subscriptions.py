"""
نقاط نهاية الاشتراكات والاستهلاك
"""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_active_user
from app.core.config import PLAN_LIMITS
from app.core.usage_limiter import UsageLimiter
from app.models.user import User, UserPlan
from app.models.usage import UserUsage, DailyUsage
from app.models.subscription import Subscription
from app.schemas.subscription import UsageStats, UpgradePlanRequest

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

# أسعار الخطط بالريال
PLAN_PRICES = {
    "free":         {"monthly": 0,    "annual": 0},
    "starter":      {"monthly": 99,   "annual": 990},
    "professional": {"monthly": 299,  "annual": 2990},
    "business":     {"monthly": 999,  "annual": 9990},
    "enterprise":   {"monthly": 4999, "annual": 49990},
}


@router.get("/usage", response_model=UsageStats)
async def get_usage(
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """إحصائيات استهلاك المستخدم الحالي"""
    from datetime import date
    now = datetime.now(timezone.utc)
    today = date.today()

    plan = user.plan.value if hasattr(user.plan, 'value') else str(user.plan)
    limits = PLAN_LIMITS[plan]

    # الاستهلاك الشهري
    monthly_res = await db.execute(
        select(UserUsage).where(
            UserUsage.user_id == user.id,
            UserUsage.year == now.year,
            UserUsage.month == now.month,
        )
    )
    monthly = monthly_res.scalar_one_or_none()

    # الاستهلاك اليومي
    daily_res = await db.execute(
        select(DailyUsage).where(
            DailyUsage.user_id == user.id,
            DailyUsage.usage_date == today,
        )
    )
    daily = daily_res.scalar_one_or_none()

    scans_used    = monthly.total_scans if monthly else 0
    ai_chat_used  = monthly.ai_chat_messages if monthly else 0
    ai_search_used= monthly.ai_search_queries if monthly else 0
    ai_cost       = monthly.ai_cost_usd if monthly else 0.0
    scans_today   = daily.scans if daily else 0
    chat_today    = daily.ai_chat_messages if daily else 0

    return UsageStats(
        plan=plan,
        scans_used=scans_used,
        scans_limit=limits["scans_per_month"],
        ai_chat_used=ai_chat_used,
        ai_chat_limit=limits["ai_chat_messages_per_month"],
        ai_search_used=ai_search_used,
        ai_search_limit=limits["ai_search_per_month"],
        ai_cost_usd=ai_cost,
        scans_today=scans_today,
        scans_daily_limit=limits["scans_per_day"],
        ai_chat_today=chat_today,
        ai_chat_daily_limit=limits["ai_chat_messages_per_day"],
        period_year=now.year,
        period_month=now.month,
    )


@router.get("/plans")
async def list_plans():
    """قائمة كل الخطط المتاحة مع الأسعار"""
    plans = []
    for plan_key, limits in PLAN_LIMITS.items():
        prices = PLAN_PRICES[plan_key]
        plans.append({
            "plan": plan_key,
            "price_monthly_sar": prices["monthly"],
            "price_annual_sar":  prices["annual"],
            "scans_per_month":   limits["scans_per_month"],
            "scans_per_day":     limits["scans_per_day"],
            "websites":          limits["websites"],
            "users_per_account": limits["users_per_account"],
            "ai_chat_per_month": limits["ai_chat_messages_per_month"],
            "ai_chat_per_day":   limits["ai_chat_messages_per_day"],
            "ai_search_per_month": limits["ai_search_per_month"],
            "ai_models":         limits["ai_models"],
            "data_retention_days": limits["data_retention_days"],
        })
    return {"plans": plans}


@router.post("/upgrade")
async def upgrade_plan(
    body: UpgradePlanRequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    طلب ترقية الخطة.
    في الإنتاج: يُعيد رابط دفع Moyasar.
    في التطوير: يُفعَّل مباشرة.
    """
    from app.core.config import settings

    new_plan = body.plan.value if hasattr(body.plan, 'value') else str(body.plan)
    old_plan = user.plan.value if hasattr(user.plan, 'value') else str(user.plan)

    if new_plan == old_plan:
        raise HTTPException(400, detail={"message": "أنت على هذه الخطة بالفعل"})

    prices = PLAN_PRICES.get(new_plan, {})
    amount = prices.get(body.billing, 0)

    # في بيئة التطوير: تفعيل مباشر بدون دفع
    if settings.APP_ENV == "development":
        from datetime import timedelta
        user.plan = body.plan
        days = 365 if body.billing == "annual" else 30
        user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=days)

        sub = Subscription(
            user_id=user.id,
            plan=new_plan,
            prev_plan=old_plan,
            amount_sar=amount,
            billing=body.billing,
            status="active",
            starts_at=datetime.now(timezone.utc),
            expires_at=user.plan_expires_at,
        )
        db.add(sub)
        await db.commit()

        return {
            "success": True,
            "message": f"تمت الترقية إلى {new_plan} (بيئة تطوير)",
            "plan": new_plan,
            "expires_at": user.plan_expires_at.isoformat(),
        }

    # في الإنتاج: إرجاع رابط Moyasar (المرحلة 6)
    return {
        "success": False,
        "message": "يتطلب تكامل Moyasar — سيُبنى في المرحلة 6",
        "payment_url": None,
    }


@router.get("/history")
async def subscription_history(
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """تاريخ الاشتراكات"""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == user.id)
        .order_by(Subscription.created_at.desc())
        .limit(20)
    )
    subs = result.scalars().all()
    return {
        "subscriptions": [
            {
                "id": s.id,
                "plan": s.plan,
                "prev_plan": s.prev_plan,
                "amount_sar": s.amount_sar,
                "billing": s.billing,
                "status": s.status,
                "starts_at": s.starts_at.isoformat() if s.starts_at else None,
                "expires_at": s.expires_at.isoformat() if s.expires_at else None,
                "created_at": s.created_at.isoformat(),
            }
            for s in subs
        ]
    }
