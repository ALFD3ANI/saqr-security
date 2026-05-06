"""
إعدادات المشروع - تُقرأ من متغيرات البيئة (.env)
كل الأسرار هنا تأتي من البيئة، مش مكتوبة مباشرةً في الكود
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    # ── المعلومات الأساسية للتطبيق ─────────────────────────────
    APP_NAME: str = "Saqr Security"
    APP_NAME_AR: str = "أمان الصقر"
    APP_VERSION: str = "0.1.0"
    APP_ENV: str = "development"
    APP_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"
    ADMIN_EMAIL: str = "admin@saqr-security.com"
    ADMIN_PHONE: str = ""

    # ── الأمان ─────────────────────────────────────────────────
    JWT_SECRET: str = "change-this-super-secret-key-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    ENCRYPTION_KEY: str = "change-this-32-char-encryption-key!!"
    ADMIN_2FA_REQUIRED: bool = False

    # ── قاعدة البيانات ──────────────────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://saqr:saqrpass@localhost:5432/saqr_db"
    DATABASE_URL_SYNC: str = "postgresql://saqr:saqrpass@localhost:5432/saqr_db"
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── الذكاء الاصطناعي (مفتاح المنصة الموحد) ─────────────────
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""

    # حدود التكاليف اليومية والشهرية بالدولار
    AI_DAILY_LIMIT_USD: float = 50.0
    AI_MONTHLY_LIMIT_USD: float = 1500.0
    AI_ALERT_EMAIL: str = "admin@saqr-security.com"
    AI_ALERT_PHONE: str = ""

    # ── بوابات الدفع السعودية ───────────────────────────────────
    MOYASAR_API_KEY: str = ""
    MOYASAR_PUBLISHABLE_KEY: str = ""
    MOYASAR_WEBHOOK_SECRET: str = ""
    ZATCA_API_KEY: str = ""
    ZATCA_VAT_NUMBER: str = ""

    # ── الإيميل ────────────────────────────────────────────────
    SENDGRID_API_KEY: str = ""
    MAIL_FROM: str = "noreply@saqr-security.com"
    MAIL_FROM_NAME: str = "Saqr Security"

    # ── الرسائل القصيرة ─────────────────────────────────────────
    UNIFONIC_APP_SID: str = ""
    UNIFONIC_SENDER: str = "Saqr"

    # ── WAF Integrations ────────────────────────────────────────
    CLOUDFLARE_API_TOKEN: str = ""
    AWS_WAF_ACCESS_KEY: str = ""
    AWS_WAF_SECRET_KEY: str = ""

    # ── المراقبة ────────────────────────────────────────────────
    SENTRY_DSN: str = ""

    # ── GitHub OAuth ────────────────────────────────────────────
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    # ── Feature Flags ───────────────────────────────────────────
    ENABLE_AUTO_APPROVAL_LOW_RISK: bool = False
    ENABLE_AUTOFIX_ENTERPRISE: bool = False
    ENABLE_DARKWEB_MONITORING: bool = False
    ENABLE_BYOK: bool = False

    # ── CORS ────────────────────────────────────────────────────
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    @field_validator("ALLOWED_ORIGINS", mode="before")
    @classmethod
    def parse_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()


# النماذج المتاحة من Anthropic
ANTHROPIC_MODELS = {
    "haiku": "claude-haiku-4-5-20251001",
    "sonnet": "claude-sonnet-4-6",
    "opus": "claude-opus-4-7",
}

# حدود كل خطة اشتراك
PLAN_LIMITS = {
    "free": {
        "scans_per_month": 3,
        "scans_per_day": 1,
        "websites": 1,
        "users_per_account": 1,
        "data_retention_days": 7,
        "ai_chat_messages_per_month": 10,
        "ai_chat_messages_per_day": 5,
        "ai_search_per_month": 20,
        "ai_search_per_day": 10,
        "max_message_tokens": 500,
        "rate_limit_per_minute": 2,
        "ai_models": ["haiku"],
    },
    "starter": {
        "scans_per_month": 25,
        "scans_per_day": 5,
        "websites": 5,
        "users_per_account": 1,
        "data_retention_days": 90,
        "ai_chat_messages_per_month": 200,
        "ai_chat_messages_per_day": 20,
        "ai_search_per_month": 500,
        "ai_search_per_day": 50,
        "max_message_tokens": 1000,
        "rate_limit_per_minute": 5,
        "ai_models": ["haiku"],
    },
    "professional": {
        "scans_per_month": 100,
        "scans_per_day": 20,
        "websites": 20,
        "users_per_account": 3,
        "data_retention_days": 365,
        "ai_chat_messages_per_month": 1000,
        "ai_chat_messages_per_day": 100,
        "ai_search_per_month": 3000,
        "ai_search_per_day": 200,
        "max_message_tokens": 2000,
        "rate_limit_per_minute": 10,
        "ai_models": ["haiku", "sonnet"],
    },
    "business": {
        "scans_per_month": 500,
        "scans_per_day": 100,
        "websites": 100,
        "users_per_account": 5,
        "data_retention_days": 1095,
        "ai_chat_messages_per_month": 5000,
        "ai_chat_messages_per_day": 500,
        "ai_search_per_month": 15000,
        "ai_search_per_day": 1000,
        "max_message_tokens": 5000,
        "rate_limit_per_minute": 30,
        "ai_models": ["haiku", "sonnet"],
    },
    "enterprise": {
        "scans_per_month": 10000,
        "scans_per_day": 1000,
        "websites": -1,  # -1 = unlimited
        "users_per_account": -1,
        "data_retention_days": -1,
        "ai_chat_messages_per_month": 50000,
        "ai_chat_messages_per_day": 2000,
        "ai_search_per_month": 150000,
        "ai_search_per_day": 5000,
        "max_message_tokens": 10000,
        "rate_limit_per_minute": 100,
        "ai_models": ["haiku", "sonnet", "opus"],
    },
}
