"""
نقطة دخول الـ Backend - FastAPI Application
"""
import time
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.database import create_tables
from app.api.v1.setup import router as setup_router
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.subscriptions import router as subscriptions_router
from app.api.v1.admin.dashboard import router as admin_dashboard_router
from app.api.v1.admin.approvals import router as admin_approvals_router
from app.api.v1.admin.users import router as admin_users_router
from app.api.v1.admin.security import router as admin_security_router
from app.api.v1.scans import router as scans_router
from app.api.v1.ai import router as ai_router
from app.api.v1.compliance import router as compliance_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """يشتغل عند بدء وإيقاف التطبيق"""
    logger.info("🦅 Saqr Security API starting...", env=settings.APP_ENV)
    try:
        await create_tables()
        logger.info("Database tables created/verified")
    except Exception as e:
        logger.error("Failed to create tables on startup", error=str(e))
    yield
    logger.info("🦅 Saqr Security API stopping...")


app = FastAPI(
    title=settings.APP_NAME,
    description="منصة الأمن السيبراني مدعومة بالذكاء الاصطناعي",
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url="/redoc" if settings.APP_ENV != "production" else None,
    lifespan=lifespan,
)

# ── Middleware: CORS (السماح للـ Frontend بالتواصل مع الـ Backend) ──────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.all_allowed_origins,
    # يسمح بأي نطاق فرعي على Vercel أو Cloudflare Pages أو localhost
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?|https://.*\.vercel\.app|https://.*\.pages\.dev|https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Middleware: وقت الاستجابة ───────────────────────────────────────────
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}s"
    return response


# ── Middleware: حماية من الـ Security Headers ──────────────────────────
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ── Global Exception Handler ───────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", error=str(exc)[:400], path=request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_server_error",
            "message": "حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى",
            "message_en": "An unexpected error occurred, please try again",
        },
    )


# ── تسجيل الـ Routers ──────────────────────────────────────────────────
app.include_router(setup_router, prefix="/api/v1")
app.include_router(health_router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1")
app.include_router(subscriptions_router, prefix="/api/v1")
app.include_router(admin_dashboard_router, prefix="/api/v1")
app.include_router(admin_approvals_router, prefix="/api/v1")
app.include_router(admin_users_router, prefix="/api/v1")
app.include_router(admin_security_router, prefix="/api/v1")
app.include_router(scans_router, prefix="/api/v1")
app.include_router(ai_router, prefix="/api/v1")
app.include_router(compliance_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.APP_ENV == "development",
    )
