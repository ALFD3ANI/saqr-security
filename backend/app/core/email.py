"""
Email Service — إرسال الإشعارات بالبريد الإلكتروني
يستخدم SendGrid API إن كان المفتاح موجوداً، وإلا يُسجّل في الـ console
"""
import structlog
from app.core.config import settings

logger = structlog.get_logger()


async def send_email(to: str, subject: str, html: str) -> bool:
    """إرسال إيميل عبر SendGrid أو mock في التطوير"""
    if not settings.SENDGRID_API_KEY:
        logger.info("📧 [MOCK EMAIL]", to=to, subject=subject)
        return True

    import httpx
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.sendgrid.com/v3/mail/send",
                headers={
                    "Authorization": f"Bearer {settings.SENDGRID_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "personalizations": [{"to": [{"email": to}]}],
                    "from": {
                        "email": settings.MAIL_FROM,
                        "name":  settings.MAIL_FROM_NAME,
                    },
                    "subject": subject,
                    "content": [{"type": "text/html", "value": html}],
                },
                timeout=10,
            )
            return 200 <= resp.status_code < 300
    except Exception as e:
        logger.error("Email send failed", error=str(e), to=to)
        return False


def _base_template(content: str) -> str:
    return f"""
    <!DOCTYPE html><html lang="ar" dir="rtl">
    <head><meta charset="UTF-8">
    <style>
      body {{ font-family: 'Segoe UI', sans-serif; background: #0d0d1a; color: #e2e8f0;
              margin: 0; padding: 40px 20px; direction: rtl; }}
      .card {{ background: #1a1a2e; border: 1px solid #2d2d3d; border-radius: 16px;
               max-width: 540px; margin: 0 auto; padding: 32px; }}
      .logo {{ font-size: 24px; font-weight: 900; color: #6366f1; margin-bottom: 24px; }}
      h2 {{ font-size: 20px; margin: 0 0 12px; color: #f1f5f9; }}
      p {{ color: #94a3b8; line-height: 1.7; margin: 8px 0; }}
      .badge {{ display: inline-block; padding: 4px 12px; border-radius: 20px;
                font-size: 13px; font-weight: 600; margin: 8px 0; }}
      .success {{ background: rgba(16,185,129,.15); color: #10b981; border: 1px solid rgba(16,185,129,.3); }}
      .danger  {{ background: rgba(239,68,68,.15);  color: #ef4444;  border: 1px solid rgba(239,68,68,.3);  }}
      .info    {{ background: rgba(99,102,241,.15); color: #6366f1;  border: 1px solid rgba(99,102,241,.3); }}
      .footer  {{ text-align: center; margin-top: 24px; color: #475569; font-size: 12px; }}
      a {{ color: #6366f1; text-decoration: none; }}
    </style></head>
    <body><div class="card">
      <div class="logo">🦅 Saqr Security</div>
      {content}
      <div class="footer">منصة الأمن السيبراني للشركات السعودية والخليجية</div>
    </div></body></html>
    """


async def send_approval_approved(email: str, name: str, plan: str) -> None:
    """إيميل الموافقة على الحساب"""
    frontend = settings.FRONTEND_URL
    content = f"""
    <h2>تم تفعيل حسابك! 🎉</h2>
    <p>مرحباً <strong>{name}</strong>،</p>
    <p>يسعدنا إعلامك بأن طلب تفعيل حسابك على منصة Saqr Security قد تمت الموافقة عليه.</p>
    <span class="badge success">✓ الحساب مُفعَّل</span>
    <p>الخطة: <strong>{plan.upper()}</strong></p>
    <p>يمكنك الآن تسجيل الدخول والبدء بفحص مواقعك الإلكترونية.</p>
    <p style="margin-top:20px">
      <a href="{frontend}/login"
         style="background:#6366f1;color:#fff;padding:12px 28px;border-radius:10px;display:inline-block;font-weight:600">
        تسجيل الدخول ←
      </a>
    </p>
    """
    await send_email(email, "تم تفعيل حسابك على Saqr Security", _base_template(content))


async def send_approval_rejected(email: str, name: str, reason: str) -> None:
    """إيميل رفض الحساب"""
    content = f"""
    <h2>بخصوص طلب التفعيل</h2>
    <p>مرحباً <strong>{name}</strong>،</p>
    <p>نأسف لإبلاغك بأننا لم نتمكن من تفعيل حسابك في الوقت الحالي.</p>
    <span class="badge danger">✗ تعذّر التفعيل</span>
    {f'<p><strong>السبب:</strong> {reason}</p>' if reason else ''}
    <p>للاستفسار أو إعادة التقديم، يرجى التواصل مع فريق الدعم.</p>
    """
    await send_email(email, "بخصوص طلب التفعيل على Saqr Security", _base_template(content))


async def send_welcome_email(email: str, name: str) -> None:
    """إيميل ترحيبي بعد التسجيل"""
    content = f"""
    <h2>أهلاً وسهلاً، {name}! 👋</h2>
    <p>شكراً لتسجيلك في منصة <strong>Saqr Security</strong>.</p>
    <span class="badge info">طلبك قيد المراجعة</span>
    <p>سيقوم فريقنا بمراجعة طلبك وسيصلك إيميل بالنتيجة خلال 24 ساعة.</p>
    <p>في حال وجود أي استفسار، لا تتردد في التواصل معنا.</p>
    """
    await send_email(email, "أهلاً بك في Saqr Security", _base_template(content))
