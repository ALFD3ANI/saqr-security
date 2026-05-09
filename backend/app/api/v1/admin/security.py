"""
Admin Security Center — مركز الأمن والمراقبة
إحصائيات الفحوصات والذكاء الاصطناعي وصحة المنظومة
"""
from datetime import datetime, timezone, date

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_admin_user
from app.core.config import settings
from app.models.scan import Scan
from app.models.user import User, AccountStatus
from app.models.usage import UserUsage, DailyUsage

router = APIRouter(prefix="/admin/security", tags=["Admin"])


@router.get("/stats")
async def get_security_stats(
    admin=Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """إحصائيات منصة الأمن: فحوصات، AI، صحة النظام"""
    now  = datetime.now(timezone.utc)
    today = date.today()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # ── Scan Stats ───────────────────────────────────────────────
    total_scans = await db.scalar(select(func.count(Scan.id))) or 0
    scans_today = await db.scalar(
        select(func.count(Scan.id)).where(func.date(Scan.created_at) == today)
    ) or 0
    scans_month = await db.scalar(
        select(func.count(Scan.id)).where(Scan.created_at >= month_start)
    ) or 0
    running_scans = await db.scalar(
        select(func.count(Scan.id)).where(Scan.status == "running")
    ) or 0
    failed_scans = await db.scalar(
        select(func.count(Scan.id)).where(Scan.status == "failed")
    ) or 0
    high_risk_scans = await db.scalar(
        select(func.count(Scan.id))
        .where(Scan.status == "completed", Scan.risk_score >= 70)
    ) or 0
    avg_risk = await db.scalar(
        select(func.avg(Scan.risk_score)).where(Scan.status == "completed")
    ) or 0

    # Scans by type
    by_type_rows = await db.execute(
        select(Scan.scan_type, func.count(Scan.id)).group_by(Scan.scan_type)
    )
    by_type = {r[0]: r[1] for r in by_type_rows}

    # Scans by status
    by_status_rows = await db.execute(
        select(Scan.status, func.count(Scan.id)).group_by(Scan.status)
    )
    by_status = {r[0]: r[1] for r in by_status_rows}

    # ── AI Stats ─────────────────────────────────────────────────
    ai_month = await db.scalar(
        select(func.sum(UserUsage.ai_chat_messages))
        .where(UserUsage.year == now.year, UserUsage.month == now.month)
    ) or 0
    ai_cost_month = await db.scalar(
        select(func.sum(UserUsage.ai_cost_usd))
        .where(UserUsage.year == now.year, UserUsage.month == now.month)
    ) or 0.0
    ai_today = await db.scalar(
        select(func.sum(DailyUsage.ai_chat_messages))
        .where(DailyUsage.usage_date == today)
    ) or 0

    # ── Users Stats ──────────────────────────────────────────────
    users_active = await db.scalar(
        select(func.count(User.id)).where(User.status == AccountStatus.ACTIVE)
    ) or 0
    users_total = await db.scalar(select(func.count(User.id))) or 0

    # ── System Health ─────────────────────────────────────────────
    ai_api_key = getattr(settings, "ANTHROPIC_API_KEY", "") or ""
    payment_key = getattr(settings, "MOYASAR_API_KEY", "") or ""
    system_health = {
        "database": "ok",
        "ai_api": "configured" if ai_api_key else "mock_mode",
        "payment": "configured" if payment_key else "mock_mode",
        "env": getattr(settings, "APP_ENV", "development"),
    }

    # ── Recent Scans (all users) ──────────────────────────────────
    recent_rows = await db.execute(
        select(Scan, User.email, User.full_name)
        .join(User, Scan.user_id == User.id)
        .order_by(Scan.created_at.desc())
        .limit(15)
    )
    recent_scans = [
        {
            "id":           s.id,
            "scan_type":    s.scan_type,
            "target":       s.target_display or s.target[:60],
            "status":       s.status,
            "risk_score":   s.risk_score,
            "risk_level":   s.risk_level,
            "created_at":   s.created_at.isoformat(),
            "user_email":   email,
            "user_name":    name,
        }
        for s, email, name in recent_rows
    ]

    return {
        "scans": {
            "total":       total_scans,
            "today":       scans_today,
            "this_month":  scans_month,
            "running":     running_scans,
            "failed":      failed_scans,
            "high_risk":   high_risk_scans,
            "avg_risk":    round(float(avg_risk), 1),
            "by_type":     by_type,
            "by_status":   by_status,
        },
        "ai": {
            "messages_today":      int(ai_today),
            "messages_this_month": int(ai_month),
            "cost_usd_this_month": round(float(ai_cost_month), 4),
        },
        "users": {
            "total":  users_total,
            "active": users_active,
        },
        "system": system_health,
        "recent_scans": recent_scans,
    }
