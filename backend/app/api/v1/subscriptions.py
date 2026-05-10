"""
نقاط نهاية الاشتراكات والفواتير والمدفوعات
"""
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_active_user, get_current_user
from app.core.config import PLAN_LIMITS, settings
from app.core.usage_limiter import UsageLimiter
from app.core.moyasar import create_payment, get_payment, verify_webhook_signature, generate_invoice_number
from app.models.user import User, UserPlan
from app.models.usage import UserUsage, DailyUsage
from app.models.subscription import Subscription
from app.models.payment import Payment
from app.schemas.subscription import UsageStats, UpgradePlanRequest

router = APIRouter(prefix="/subscriptions", tags=["Subscriptions"])

PLAN_PRICES = {
    "free":         {"monthly": 0,    "annual": 0},
    "starter":      {"monthly": 99,   "annual": 990},
    "professional": {"monthly": 299,  "annual": 2990},
    "business":     {"monthly": 999,  "annual": 9990},
    "enterprise":   {"monthly": 4999, "annual": 49990},
}


# ── استهلاك المستخدم ────────────────────────────────────────────

@router.get("/usage", response_model=UsageStats)
async def get_usage(
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    from datetime import date
    now = datetime.now(timezone.utc)
    today = date.today()

    plan = user.plan.value if hasattr(user.plan, 'value') else str(user.plan)
    limits = PLAN_LIMITS[plan]

    monthly_res = await db.execute(
        select(UserUsage).where(
            UserUsage.user_id == user.id,
            UserUsage.year == now.year,
            UserUsage.month == now.month,
        )
    )
    monthly = monthly_res.scalar_one_or_none()

    daily_res = await db.execute(
        select(DailyUsage).where(
            DailyUsage.user_id == user.id,
            DailyUsage.usage_date == today,
        )
    )
    daily = daily_res.scalar_one_or_none()

    return UsageStats(
        plan=plan,
        scans_used=monthly.total_scans if monthly else 0,
        scans_limit=limits["scans_per_month"],
        ai_chat_used=monthly.ai_chat_messages if monthly else 0,
        ai_chat_limit=limits["ai_chat_messages_per_month"],
        ai_search_used=monthly.ai_search_queries if monthly else 0,
        ai_search_limit=limits["ai_search_per_month"],
        ai_cost_usd=monthly.ai_cost_usd if monthly else 0.0,
        scans_today=daily.scans if daily else 0,
        scans_daily_limit=limits["scans_per_day"],
        ai_chat_today=daily.ai_chat_messages if daily else 0,
        ai_chat_daily_limit=limits["ai_chat_messages_per_day"],
        period_year=now.year,
        period_month=now.month,
    )


# ── قائمة الخطط ─────────────────────────────────────────────────

@router.get("/plans")
async def list_plans():
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


# ── إنشاء جلسة دفع (Checkout) ───────────────────────────────────

@router.post("/checkout")
async def create_checkout(
    body: UpgradePlanRequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """
    إنشاء رابط دفع Moyasar.
    في التطوير: يُعيد رابط وهمي يُنهي العملية مباشرةً.
    """
    new_plan = body.plan.value if hasattr(body.plan, 'value') else str(body.plan)
    old_plan = user.plan.value  if hasattr(user.plan, 'value')  else str(user.plan)

    if new_plan == old_plan:
        raise HTTPException(400, detail={"message": "أنت على هذه الخطة بالفعل"})
    if new_plan == "free":
        raise HTTPException(400, detail={"message": "لا يمكن الانتقال إلى الخطة المجانية عبر الدفع"})

    if body.billing not in ("monthly", "annual"):
        raise HTTPException(400, detail={"message": "نوع الفاتورة غير صالح، يجب أن يكون monthly أو annual"})

    prices = PLAN_PRICES.get(new_plan, {})
    amount_sar = prices.get(body.billing, 0)
    if amount_sar == 0:
        raise HTTPException(400, detail={"message": "الخطة مجانية أو غير صالحة"})

    amount_halala = int(amount_sar * 100)

    # إنشاء سجل الدفعة في قاعدة البيانات
    payment = Payment(
        user_id=user.id,
        amount_sar=amount_sar,
        amount_halala=amount_halala,
        plan=new_plan,
        billing=body.billing,
        status="pending",
    )
    db.add(payment)
    await db.flush()  # نحصل على payment.id

    callback_url = f"{settings.FRONTEND_URL}/payment/callback"

    try:
        moyasar_resp = await create_payment(
            amount_halala=amount_halala,
            description=f"Saqr Security — {new_plan} ({body.billing})",
            callback_url=callback_url,
            metadata={"user_id": user.id, "plan": new_plan, "billing": body.billing, "payment_db_id": payment.id},
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(502, detail={"message": f"خطأ في الاتصال ببوابة الدفع: {str(e)}"})

    payment.moyasar_id = moyasar_resp.get("id")
    payment.moyasar_data = json.dumps(moyasar_resp)
    await db.commit()

    payment_url = moyasar_resp.get("source", {}).get("transaction_url") or \
                  f"{settings.FRONTEND_URL}/payment/callback?id={payment.moyasar_id}&status=paid"

    return {
        "success": True,
        "payment_id": payment.id,
        "moyasar_id": payment.moyasar_id,
        "amount_sar": amount_sar,
        "plan": new_plan,
        "billing": body.billing,
        "payment_url": payment_url,
        "is_mock": moyasar_resp.get("_mock", False),
    }


# ── التحقق من حالة الدفع وتفعيل الاشتراك ───────────────────────

@router.post("/payment/{moyasar_id}/verify")
async def verify_payment(
    moyasar_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    يُستدعى من الفرونت إند بعد إعادة التوجيه من Moyasar.
    يتحقق من الحالة ويُفعّل الاشتراك عند النجاح.
    """
    # ابحث عن الدفعة
    res = await db.execute(
        select(Payment).where(Payment.moyasar_id == moyasar_id, Payment.user_id == user.id)
    )
    payment = res.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, detail={"message": "الدفعة غير موجودة"})

    if payment.status == "paid":
        return {"success": True, "status": "paid", "plan": payment.plan, "already_processed": True}

    # استعلم من Moyasar
    try:
        moyasar_data = await get_payment(moyasar_id)
    except Exception:
        raise HTTPException(502, detail={"message": "تعذّر التواصل مع بوابة الدفع"})

    moyasar_status = moyasar_data.get("status", "")
    payment.moyasar_data = json.dumps(moyasar_data)

    if moyasar_status == "paid":
        payment.status = "paid"
        old_plan = user.plan.value if hasattr(user.plan, 'value') else str(user.plan)
        days = 365 if payment.billing == "annual" else 30

        user.plan = UserPlan(payment.plan)
        user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=days)

        # إنشاء سجل الاشتراك
        sub = Subscription(
            user_id=user.id,
            plan=payment.plan,
            prev_plan=old_plan,
            amount_sar=payment.amount_sar,
            billing=payment.billing,
            status="active",
            starts_at=datetime.now(timezone.utc),
            expires_at=user.plan_expires_at,
        )
        db.add(sub)

        # رقم الفاتورة
        payment.invoice_number = generate_invoice_number(user.id, payment.id)
        await db.commit()

        return {
            "success": True,
            "status": "paid",
            "plan": payment.plan,
            "expires_at": user.plan_expires_at.isoformat(),
            "invoice_number": payment.invoice_number,
        }

    elif moyasar_status in ("failed", "refunded", "voided"):
        payment.status = moyasar_status
        await db.commit()
        return {"success": False, "status": moyasar_status}

    # لا تزال معلّقة
    await db.commit()
    return {"success": False, "status": "pending"}


# ── Webhook من Moyasar ──────────────────────────────────────────

@router.post("/webhook/moyasar")
async def moyasar_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_moyasar_signature: Optional[str] = Header(None),
):
    """Webhook لاستقبال تحديثات الدفع من Moyasar"""
    body = await request.body()

    if not verify_webhook_signature(body, x_moyasar_signature or ""):
        raise HTTPException(401, detail="Invalid webhook signature")

    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(400, detail="Invalid JSON")

    moyasar_id = event.get("id")
    new_status = event.get("status")

    if not moyasar_id:
        return {"received": True}

    res = await db.execute(select(Payment).where(Payment.moyasar_id == moyasar_id))
    payment = res.scalar_one_or_none()
    if not payment or payment.status == "paid":
        return {"received": True}

    payment.moyasar_data = json.dumps(event)

    if new_status == "paid" and payment.status != "paid":
        payment.status = "paid"
        user = await db.get(User, payment.user_id)
        if user:
            old_plan = user.plan.value if hasattr(user.plan, 'value') else str(user.plan)
            days = 365 if payment.billing == "annual" else 30
            user.plan = UserPlan(payment.plan)
            user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=days)
            sub = Subscription(
                user_id=user.id, plan=payment.plan, prev_plan=old_plan,
                amount_sar=payment.amount_sar, billing=payment.billing,
                status="active", starts_at=datetime.now(timezone.utc), expires_at=user.plan_expires_at,
            )
            db.add(sub)
            if not payment.invoice_number:
                payment.invoice_number = generate_invoice_number(user.id, payment.id)
    elif new_status in ("failed", "refunded", "voided"):
        payment.status = new_status

    await db.commit()
    return {"received": True}


# ── تاريخ الاشتراكات والفواتير ──────────────────────────────────

@router.get("/history")
async def subscription_history(
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
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


@router.get("/invoices")
async def list_invoices(
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user.id, Payment.status == "paid")
        .order_by(Payment.created_at.desc())
        .limit(50)
    )
    payments = result.scalars().all()
    return {
        "invoices": [
            {
                "id": p.id,
                "invoice_number": p.invoice_number,
                "plan": p.plan,
                "billing": p.billing,
                "amount_sar": p.amount_sar,
                "status": p.status,
                "created_at": p.created_at.isoformat(),
            }
            for p in payments
        ]
    }


# ── ترقية مباشرة (dev only) ─────────────────────────────────────

@router.post("/upgrade")
async def upgrade_plan(
    body: UpgradePlanRequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """في التطوير: ترقية فورية. في الإنتاج: أرسل للـ checkout."""
    if settings.APP_ENV != "development":
        raise HTTPException(400, detail={"message": "استخدم /checkout في الإنتاج"})

    new_plan = body.plan.value if hasattr(body.plan, 'value') else str(body.plan)
    old_plan = user.plan.value if hasattr(user.plan, 'value') else str(user.plan)
    if new_plan == old_plan:
        raise HTTPException(400, detail={"message": "أنت على هذه الخطة بالفعل"})

    prices = PLAN_PRICES.get(new_plan, {})
    amount = prices.get(body.billing, 0)
    days = 365 if body.billing == "annual" else 30

    user.plan = body.plan
    user.plan_expires_at = datetime.now(timezone.utc) + timedelta(days=days)

    sub = Subscription(
        user_id=user.id, plan=new_plan, prev_plan=old_plan,
        amount_sar=amount, billing=body.billing, status="active",
        starts_at=datetime.now(timezone.utc), expires_at=user.plan_expires_at,
    )
    db.add(sub)
    await db.commit()

    return {
        "success": True,
        "message": f"تمت الترقية إلى {new_plan} (بيئة تطوير)",
        "plan": new_plan,
        "expires_at": user.plan_expires_at.isoformat(),
    }
