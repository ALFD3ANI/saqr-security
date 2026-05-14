"""
نقطة الـ Health Check - للتأكد إن الـ Backend شغّال
"""
from fastapi import APIRouter
from app.core.config import settings, ANTHROPIC_MODELS

router = APIRouter()


@router.get("/", tags=["Health"])
async def root():
    return {
        "name": settings.APP_NAME,
        "name_ar": settings.APP_NAME_AR,
        "version": settings.APP_VERSION,
        "status": "operational",
        "message": "Welcome to Saqr Security 🦅",
        "message_ar": "أهلاً بك في أمان الصقر 🦅",
        "ai_models_available": list(ANTHROPIC_MODELS.keys()),
        "environment": settings.APP_ENV,
    }


@router.get("/health", tags=["Health"])
async def health_check():
    """فحص صحة الـ API + اختبار اتصال قاعدة البيانات"""
    db_ok = False
    try:
        from app.core.database import engine
        async with engine.connect() as conn:
            from sqlalchemy import text
            await conn.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "db": "connected" if db_ok else "unreachable",
    }


@router.get("/ping", tags=["Health"])
async def ping():
    """أسرع نقطة ممكنة للـ keep-alive — لا تلمس قاعدة البيانات"""
    return {"ok": True, "v": "fix-2026-05-14"}
