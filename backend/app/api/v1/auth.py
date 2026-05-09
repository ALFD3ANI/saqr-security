"""
نقاط نهاية التوثيق: تسجيل، دخول، JWT، 2FA، كلمة مرور
"""
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_active_user, get_current_user
from app.core.security import (
    create_access_token, create_refresh_token, decode_token,
    generate_secure_token, generate_totp_secret, get_totp_uri,
    hash_password, verify_password, verify_totp_code,
)
from app.models.user import AccountStatus, User, UserPlan, UserRole
from app.schemas.auth import (
    ChangePasswordRequest, Enable2FARequest, ForgotPasswordRequest,
    LoginRequest, MessageResponse, RefreshTokenRequest, RegisterRequest,
    ResetPasswordRequest, TokenResponse, TotpSetupResponse, UserResponse,
    UpdateProfileRequest,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])
logger = structlog.get_logger()


# ── التسجيل ──────────────────────────────────────────────────

@router.post("/register", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """تسجيل حساب جديد"""

    # تحقق إن الإيميل غير مستخدم
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "email_taken", "message": "هذا الإيميل مسجّل مسبقاً"},
        )

    # تحديد الحالة الأولية
    # الخطة المجانية → تُفعَّل مباشرة
    # الخطط المدفوعة → تنتظر الدفع أولاً، ثم موافقة الأدمن
    initial_status = (
        AccountStatus.ACTIVE
        if body.plan == UserPlan.FREE
        else AccountStatus.PENDING_PAYMENT
    )

    # إنشاء رمز التحقق من الإيميل
    verify_token = generate_secure_token(32)

    user = User(
        email=body.email.lower().strip(),
        hashed_password=hash_password(body.password),
        full_name=body.full_name.strip(),
        phone=body.phone,
        company_name=body.company_name,
        company_size=body.company_size,
        use_case=body.use_case,
        plan=body.plan,
        status=initial_status,
        email_verify_token=verify_token,
        email_verify_sent_at=datetime.now(timezone.utc),
        preferred_language=body.preferred_language,
        last_login_ip=request.client.host if request.client else None,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    logger.info("user_registered", user_id=user.id, plan=body.plan, status=initial_status)

    # رسائل الرد حسب الحالة
    if initial_status == AccountStatus.ACTIVE:
        return MessageResponse(
            message="Account created successfully! Please verify your email.",
            message_ar="تم إنشاء الحساب بنجاح! يرجى التحقق من بريدك الإلكتروني.",
        )
    else:
        return MessageResponse(
            message="Registration successful. Complete payment to activate your account.",
            message_ar="تم التسجيل بنجاح. أكمل الدفع لتفعيل حسابك.",
        )


# ── تسجيل الدخول ─────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """تسجيل الدخول وإرجاع JWT"""

    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user: Optional[User] = result.scalar_one_or_none()

    # فحص الحساب المقفول
    if user and user.locked_until and user.locked_until > datetime.now(timezone.utc):
        remaining = int((user.locked_until - datetime.now(timezone.utc)).total_seconds() / 60)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "error": "account_locked",
                "message": f"الحساب مقفول مؤقتاً، حاول بعد {remaining} دقيقة",
            },
        )

    # تحقق من بيانات الدخول
    if not user or not verify_password(body.password, user.hashed_password):
        if user:
            # زيادة عداد المحاولات الفاشلة
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
                user.failed_login_attempts = 0
            await db.commit()

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_credentials", "message": "الإيميل أو كلمة المرور غير صحيحة"},
        )

    # تحقق من 2FA لو مفعّل
    if user.totp_enabled:
        if not body.totp_code:
            raise HTTPException(
                status_code=status.HTTP_200_OK,
                detail={"error": "totp_required", "message": "أدخل رمز المصادقة الثنائية"},
            )
        if not verify_totp_code(user.totp_secret, body.totp_code):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "invalid_totp", "message": "رمز 2FA غير صحيح"},
            )

    # تحقق من حالة الحساب
    if user.status == AccountStatus.BANNED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "account_banned", "message": "تم حظر حسابك"},
        )

    if user.status == AccountStatus.SUSPENDED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "account_suspended", "message": "تم تعليق حسابك، تواصل مع الدعم"},
        )

    # تسجيل دخول ناجح
    user.failed_login_attempts = 0
    user.locked_until = None
    user.last_login_at = datetime.now(timezone.utc)
    user.last_login_ip = request.client.host if request.client else None
    await db.commit()

    logger.info("user_login", user_id=user.id, plan=user.plan)

    return TokenResponse(
        access_token=create_access_token(user.id, user.email, user.role),
        refresh_token=create_refresh_token(user.id),
        user=UserResponse.model_validate(user),
    )


# ── تجديد الـ Token ──────────────────────────────────────────

@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(
    body: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
):
    """تجديد الـ access token باستخدام الـ refresh token"""
    payload = decode_token(body.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "invalid_refresh_token", "message": "رمز التجديد غير صالح"},
        )

    user_id = int(payload.get("sub", 0))
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user or user.status == AccountStatus.BANNED:
        raise HTTPException(status_code=401, detail={"error": "user_not_found"})

    return TokenResponse(
        access_token=create_access_token(user.id, user.email, user.role),
        refresh_token=create_refresh_token(user.id),
        user=UserResponse.model_validate(user),
    )


# ── التحقق من الإيميل ────────────────────────────────────────

@router.get("/verify-email/{token}", response_model=MessageResponse)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    """تأكيد الإيميل عبر الرابط المرسل"""
    result = await db.execute(
        select(User).where(User.email_verify_token == token)
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "invalid_token", "message": "رابط التحقق غير صالح أو منتهي"},
        )

    user.email_verified = True
    user.email_verify_token = None
    await db.commit()

    return MessageResponse(
        message="Email verified successfully!",
        message_ar="تم التحقق من البريد الإلكتروني بنجاح!",
    )


# ── نسيت كلمة المرور ─────────────────────────────────────────

@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    body: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """إرسال رابط إعادة تعيين كلمة المرور"""
    result = await db.execute(select(User).where(User.email == body.email.lower()))
    user = result.scalar_one_or_none()

    # نرجع نفس الرسالة دائماً (أمان — لا نكشف إن الإيميل موجود أو لا)
    success_msg = MessageResponse(
        message="If this email exists, a reset link has been sent.",
        message_ar="إذا كان الإيميل موجوداً، سيصلك رابط إعادة التعيين.",
    )

    if not user:
        return success_msg

    token = generate_secure_token(32)
    user.password_reset_token = token
    user.password_reset_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    await db.commit()

    # TODO: Phase 6 → إرسال الإيميل عبر SendGrid
    logger.info("password_reset_requested", user_id=user.id, token_prefix=token[:8])

    return success_msg


# ── إعادة تعيين كلمة المرور ──────────────────────────────────

@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """إعادة تعيين كلمة المرور بالتوكن"""
    result = await db.execute(
        select(User).where(User.password_reset_token == body.token)
    )
    user = result.scalar_one_or_none()

    if not user or not user.password_reset_expires_at:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_token", "message": "الرابط غير صالح أو منتهي الصلاحية"},
        )

    if user.password_reset_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail={"error": "token_expired", "message": "انتهت صلاحية الرابط، اطلب رابطاً جديداً"},
        )

    user.hashed_password = hash_password(body.new_password)
    user.password_reset_token = None
    user.password_reset_expires_at = None
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    logger.info("password_reset_success", user_id=user.id)

    return MessageResponse(
        message="Password reset successfully. You can now log in.",
        message_ar="تم إعادة تعيين كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.",
    )


# ── تغيير كلمة المرور (مسجّل دخول) ──────────────────────────

@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """تغيير كلمة المرور للمستخدم المسجّل"""
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(
            status_code=400,
            detail={"error": "wrong_password", "message": "كلمة المرور الحالية غير صحيحة"},
        )

    user.hashed_password = hash_password(body.new_password)
    await db.commit()

    return MessageResponse(
        message="Password changed successfully.",
        message_ar="تم تغيير كلمة المرور بنجاح.",
    )


# ── 2FA Setup ────────────────────────────────────────────────

@router.post("/2fa/setup", response_model=TotpSetupResponse)
async def setup_2fa(
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """إعداد المصادقة الثنائية (خطوة 1: الحصول على الـ QR)"""
    secret = generate_totp_secret()
    user.totp_secret = secret
    await db.commit()

    return TotpSetupResponse(
        secret=secret,
        qr_uri=get_totp_uri(secret, user.email),
    )


@router.post("/2fa/enable", response_model=MessageResponse)
async def enable_2fa(
    body: Enable2FARequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """تفعيل 2FA بعد التحقق من الكود (خطوة 2)"""
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail={"message": "ابدأ بـ /2fa/setup أولاً"})

    if not verify_totp_code(user.totp_secret, body.totp_code):
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_totp", "message": "الكود غير صحيح، تحقق من التطبيق"},
        )

    user.totp_enabled = True
    await db.commit()

    return MessageResponse(
        message="Two-factor authentication enabled.",
        message_ar="تم تفعيل المصادقة الثنائية بنجاح.",
    )


@router.post("/2fa/disable", response_model=MessageResponse)
async def disable_2fa(
    body: Enable2FARequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """إلغاء تفعيل 2FA"""
    if not user.totp_enabled or not user.totp_secret:
        raise HTTPException(status_code=400, detail={"message": "2FA غير مفعّل"})

    if not verify_totp_code(user.totp_secret, body.totp_code):
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_totp", "message": "الكود غير صحيح"},
        )

    user.totp_enabled = False
    user.totp_secret = None
    await db.commit()

    return MessageResponse(
        message="Two-factor authentication disabled.",
        message_ar="تم إيقاف المصادقة الثنائية.",
    )


# ── معلومات المستخدم الحالي ──────────────────────────────────

@router.get("/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)):
    """جلب بيانات المستخدم المسجّل حالياً"""
    return UserResponse.model_validate(user)


@router.patch("/profile", response_model=UserResponse)
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """تحديث بيانات الملف الشخصي"""
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.company_name is not None:
        user.company_name = body.company_name
    if body.phone is not None:
        user.phone = body.phone
    await db.commit()
    await db.refresh(user)
    return UserResponse.model_validate(user)
