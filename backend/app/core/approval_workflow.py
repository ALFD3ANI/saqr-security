"""
نظام الموافقة اليدوية — حساب المخاطر والقرارات التلقائية
"""
import json
from datetime import datetime, timezone, timedelta
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.approval_request import ApprovalRequest
from app.models.user import AccountStatus, User


# ── حساب درجة المخاطرة ─────────────────────────────────────

DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com",
    "throwam.com", "yopmail.com", "sharklasers.com",
}

SUSPICIOUS_COUNTRIES = {"RU", "KP", "IR", "CN"}
GCC_COUNTRIES = {"SA", "AE", "KW", "QA", "BH", "OM"}


def calculate_risk(
    email: str,
    ip: Optional[str],
    country: Optional[str],
    plan: str,
    company_name: Optional[str],
    form_fill_seconds: Optional[int] = None,
    user_agent: Optional[str] = None,
) -> tuple[int, list[str]]:
    score = 0
    flags: list[str] = []

    # فحص الإيميل
    domain = email.split("@")[-1].lower()
    if domain in DISPOSABLE_DOMAINS:
        score += 40
        flags.append("disposable_email")
    elif domain in {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com"}:
        if plan in ("business", "enterprise"):
            score += 15
            flags.append("personal_email_for_paid_plan")

    # فحص الدولة
    if country:
        if country in SUSPICIOUS_COUNTRIES:
            score += 50
            flags.append("suspicious_country")
        elif country not in GCC_COUNTRIES:
            score += 20
            flags.append("non_gcc_country")

    # Enterprise بدون شركة
    if plan == "enterprise" and not company_name:
        score += 25
        flags.append("enterprise_no_company")

    # سلوك البوت (ملأ الفورم بسرعة)
    if form_fill_seconds is not None and form_fill_seconds < 15:
        score += 30
        flags.append("bot_like_speed")

    # User agent مشبوه
    if user_agent:
        ua_lower = user_agent.lower()
        if any(x in ua_lower for x in ["python", "curl", "wget", "postman", "httpie"]):
            score += 20
            flags.append("non_browser_agent")

    return min(score, 100), flags


def get_auto_action(risk_score: int) -> str:
    """القرار التلقائي بناءً على درجة المخاطرة"""
    if risk_score <= 20:  return "auto_approve"
    if risk_score <= 60:  return "manual_review"
    if risk_score <= 85:  return "manual_review_high_risk"
    return "auto_reject"


# ── إنشاء طلب موافقة ────────────────────────────────────────

async def create_approval_request(
    db: AsyncSession,
    user: User,
    plan: str,
    ip: Optional[str] = None,
    country: Optional[str] = None,
    user_agent: Optional[str] = None,
    form_fill_seconds: Optional[int] = None,
) -> ApprovalRequest:

    risk_score, risk_flags = calculate_risk(
        email=user.email,
        ip=ip,
        country=country,
        plan=plan,
        company_name=user.company_name,
        form_fill_seconds=form_fill_seconds,
        user_agent=user_agent,
    )

    action = get_auto_action(risk_score)

    req = ApprovalRequest(
        user_id=user.id,
        requested_plan=plan,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        company_name=user.company_name,
        use_case=user.use_case,
        ip_address=ip,
        country=country,
        user_agent=user_agent,
        risk_score=risk_score,
        risk_flags=json.dumps(risk_flags),
        status="pending" if action.startswith("manual") else action.replace("auto_", ""),
    )
    db.add(req)

    # تطبيق القرار التلقائي
    if action == "auto_approve":
        user.status = AccountStatus.ACTIVE
        req.status = "approved"
        req.approved_at = datetime.now(timezone.utc)
    elif action == "auto_reject":
        user.status = AccountStatus.REJECTED
        req.status = "rejected"
        req.rejection_reason = "Auto-rejected: high risk score"

    await db.flush()
    return req


# ── تنفيذ قرار الأدمن ───────────────────────────────────────

async def process_approval_decision(
    db: AsyncSession,
    req: ApprovalRequest,
    user: User,
    decision: str,          # "approve" | "reject"
    admin_id: int,
    notes: Optional[str] = None,
    rejection_reason: Optional[str] = None,
):
    now = datetime.now(timezone.utc)

    if decision == "approve":
        req.status = "approved"
        req.approved_by = admin_id
        req.approved_at = now
        req.admin_notes = notes
        req.payment_status = "captured"

        user.status = AccountStatus.ACTIVE
        user.plan_expires_at = now + timedelta(days=30)

    else:
        req.status = "rejected"
        req.approved_by = admin_id
        req.approved_at = now
        req.admin_notes = notes
        req.rejection_reason = rejection_reason or "تم الرفض من قِبل الإدارة"
        req.payment_status = "refunded"

        user.status = AccountStatus.REJECTED

    await db.flush()
