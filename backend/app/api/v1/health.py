"""
نقطة الـ Health Check - للتأكد إن الـ Backend شغّال
"""
from fastapi import APIRouter
from app.core.config import settings, ANTHROPIC_MODELS

router = APIRouter()


@router.get("/", tags=["Health"])
async def root():
    """الصفحة الرئيسية - تأكيد إن الـ API شغّال"""
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
    """فحص صحة الـ API - يُستخدم من Docker و Load Balancer"""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
    }
