"""
UsageLimiter — يتحقق من حدود الاستخدام قبل كل عملية
ويُسجّل الاستهلاك بعدها
"""
from datetime import date, datetime, timezone
from typing import Optional
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import PLAN_LIMITS
from app.models.usage import DailyUsage, UserUsage
from app.models.user import User, UserPlan


@dataclass
class LimitCheck:
    allowed: bool
    reason: Optional[str] = None
    message_ar: Optional[str] = None
    used: int = 0
    limit: int = 0


class UsageLimiter:

    # ── جلب أو إنشاء سجل الاستهلاك الشهري ──────────────────
    @staticmethod
    async def _get_or_create_monthly(db: AsyncSession, user_id: int) -> UserUsage:
        now = datetime.now(timezone.utc)
        result = await db.execute(
            select(UserUsage).where(
                UserUsage.user_id == user_id,
                UserUsage.year == now.year,
                UserUsage.month == now.month,
            )
        )
        usage = result.scalar_one_or_none()
        if not usage:
            usage = UserUsage(user_id=user_id, year=now.year, month=now.month)
            db.add(usage)
            await db.flush()
        return usage

    @staticmethod
    async def _get_or_create_daily(db: AsyncSession, user_id: int) -> DailyUsage:
        today = date.today()
        result = await db.execute(
            select(DailyUsage).where(
                DailyUsage.user_id == user_id,
                DailyUsage.usage_date == today,
            )
        )
        daily = result.scalar_one_or_none()
        if not daily:
            daily = DailyUsage(user_id=user_id, usage_date=today)
            db.add(daily)
            await db.flush()
        return daily

    # ── فحص الحدود ──────────────────────────────────────────
    @staticmethod
    async def check_scan(db: AsyncSession, user: User) -> LimitCheck:
        plan = user.plan.value if hasattr(user.plan, 'value') else user.plan
        limits = PLAN_LIMITS[plan]

        monthly = await UsageLimiter._get_or_create_monthly(db, user.id)
        daily   = await UsageLimiter._get_or_create_daily(db, user.id)

        monthly_limit = limits["scans_per_month"]
        daily_limit   = limits["scans_per_day"]

        if monthly.total_scans >= monthly_limit:
            return LimitCheck(
                allowed=False, reason="monthly_scan_limit",
                message_ar=f"وصلت لحد الفحوصات الشهري ({monthly_limit}). رقّ خطتك للمزيد.",
                used=monthly.total_scans, limit=monthly_limit,
            )
        if daily.scans >= daily_limit:
            return LimitCheck(
                allowed=False, reason="daily_scan_limit",
                message_ar=f"وصلت لحد الفحوصات اليومي ({daily_limit}). حاول غداً.",
                used=daily.scans, limit=daily_limit,
            )
        return LimitCheck(allowed=True, used=monthly.total_scans, limit=monthly_limit)

    @staticmethod
    async def check_ai_chat(db: AsyncSession, user: User) -> LimitCheck:
        plan = user.plan.value if hasattr(user.plan, 'value') else user.plan
        limits = PLAN_LIMITS[plan]

        monthly = await UsageLimiter._get_or_create_monthly(db, user.id)
        daily   = await UsageLimiter._get_or_create_daily(db, user.id)

        m_limit = limits["ai_chat_messages_per_month"]
        d_limit = limits["ai_chat_messages_per_day"]

        if monthly.ai_chat_messages >= m_limit:
            return LimitCheck(
                allowed=False, reason="monthly_ai_limit",
                message_ar=f"استنفذت رسائل AI الشهرية ({m_limit}). رقّ خطتك أو اشترِ إضافة.",
                used=monthly.ai_chat_messages, limit=m_limit,
            )
        if daily.ai_chat_messages >= d_limit:
            return LimitCheck(
                allowed=False, reason="daily_ai_limit",
                message_ar=f"وصلت لحد رسائل AI اليومي ({d_limit}). حاول غداً.",
                used=daily.ai_chat_messages, limit=d_limit,
            )
        return LimitCheck(allowed=True, used=monthly.ai_chat_messages, limit=m_limit)

    @staticmethod
    async def check_ai_search(db: AsyncSession, user: User) -> LimitCheck:
        plan = user.plan.value if hasattr(user.plan, 'value') else user.plan
        limits = PLAN_LIMITS[plan]

        monthly = await UsageLimiter._get_or_create_monthly(db, user.id)
        daily   = await UsageLimiter._get_or_create_daily(db, user.id)

        m_limit = limits["ai_search_per_month"]
        d_limit = limits["ai_search_per_day"]

        if monthly.ai_search_queries >= m_limit:
            return LimitCheck(
                allowed=False, reason="monthly_search_limit",
                message_ar=f"استنفذت عمليات البحث الشهرية ({m_limit}).",
                used=monthly.ai_search_queries, limit=m_limit,
            )
        if daily.ai_search_queries >= d_limit:
            return LimitCheck(
                allowed=False, reason="daily_search_limit",
                message_ar=f"وصلت لحد البحث اليومي ({d_limit}).",
                used=daily.ai_search_queries, limit=d_limit,
            )
        return LimitCheck(allowed=True, used=monthly.ai_search_queries, limit=m_limit)

    # ── تسجيل الاستهلاك ─────────────────────────────────────
    @staticmethod
    async def record_scan(db: AsyncSession, user_id: int, scan_type: str = "url"):
        monthly = await UsageLimiter._get_or_create_monthly(db, user_id)
        daily   = await UsageLimiter._get_or_create_daily(db, user_id)

        field = f"{scan_type}_scans"
        if hasattr(monthly, field):
            setattr(monthly, field, getattr(monthly, field) + 1)
        else:
            monthly.url_scans += 1  # fallback for unknown types
        daily.scans += 1
        await db.flush()

    @staticmethod
    async def record_ai_chat(db: AsyncSession, user_id: int,
                              input_tokens: int = 0, output_tokens: int = 0,
                              cost_usd: float = 0.0):
        monthly = await UsageLimiter._get_or_create_monthly(db, user_id)
        daily   = await UsageLimiter._get_or_create_daily(db, user_id)

        monthly.ai_chat_messages  += 1
        monthly.ai_input_tokens   += input_tokens
        monthly.ai_output_tokens  += output_tokens
        monthly.ai_cost_usd       += cost_usd
        daily.ai_chat_messages    += 1
        await db.flush()

    @staticmethod
    async def record_ai_search(db: AsyncSession, user_id: int):
        monthly = await UsageLimiter._get_or_create_monthly(db, user_id)
        daily   = await UsageLimiter._get_or_create_daily(db, user_id)
        monthly.ai_search_queries += 1
        daily.ai_search_queries   += 1
        await db.flush()
