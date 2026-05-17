"""
AI Assistant API — المساعد الذكي للأمن السيبراني
يدعم: Streaming Chat، تحليل الفحوصات، Fix Wizard
"""
import json
from datetime import datetime, timezone, date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_active_user
from app.core.config import PLAN_LIMITS
from app.core.ai.client import stream_chat
from app.core.ai.prompts import get_security_assistant_prompt, get_fix_wizard_prompt, get_scan_analysis_prompt
from app.models.user import User
from app.models.ai_conversation import AIConversation
from app.models.usage import UserUsage, DailyUsage
from app.models.scan import Scan

router = APIRouter(prefix="/ai", tags=["AI"])

MAX_HISTORY_MESSAGES = 20   # آخر N رسالة تُرسل كـ context
MAX_TITLE_LENGTH     = 60


# ── Request Models ──────────────────────────────────────────────

class ChatRequest(BaseModel):
    message:         str
    conversation_id: Optional[int] = None
    model:           Optional[str] = None   # haiku | sonnet | opus
    scan_id:         Optional[int] = None   # ربط المحادثة بفحص


class FixWizardRequest(BaseModel):
    finding_title:       str
    finding_description: str
    evidence:            Optional[str] = None


class SearchRequest(BaseModel):
    query:   str
    context: Optional[str] = None


# ── الوصول إلى حدود الخطة ──────────────────────────────────────

def _get_plan_str(user: User) -> str:
    return user.plan.value if hasattr(user.plan, "value") else str(user.plan)


async def _check_ai_limit(db: AsyncSession, user: User) -> None:
    plan = _get_plan_str(user)
    limits = PLAN_LIMITS[plan]
    now = datetime.now(timezone.utc)
    today = date.today()

    monthly = await db.scalar(
        select(UserUsage).where(
            UserUsage.user_id == user.id,
            UserUsage.year == now.year,
            UserUsage.month == now.month,
        )
    )
    if monthly and monthly.ai_chat_messages >= limits["ai_chat_messages_per_month"]:
        raise HTTPException(429, detail={
            "message": f"وصلت للحد الشهري ({limits['ai_chat_messages_per_month']} رسالة). يرجى ترقية خطتك.",
            "reason": "monthly_limit",
        })

    daily = await db.scalar(
        select(DailyUsage).where(
            DailyUsage.user_id == user.id,
            DailyUsage.usage_date == today,
        )
    )
    if daily and daily.ai_chat_messages >= limits["ai_chat_messages_per_day"]:
        raise HTTPException(429, detail={
            "message": f"وصلت للحد اليومي ({limits['ai_chat_messages_per_day']} رسالة). حاول غداً أو ارقِ خطتك.",
            "reason": "daily_limit",
        })


def _choose_model(user: User, requested: Optional[str]) -> str:
    plan = _get_plan_str(user)
    allowed = PLAN_LIMITS[plan]["ai_models"]
    if requested and requested in allowed:
        return requested
    # Default: best model allowed by plan
    for m in ["opus", "sonnet", "haiku"]:
        if m in allowed:
            return m
    return "haiku"


async def _record_ai_usage(user_id: int, input_tokens: int, output_tokens: int, cost_usd: float) -> None:
    """تسجيل استهلاك AI في قاعدة البيانات"""
    now = datetime.now(timezone.utc)
    today = date.today()
    async with AsyncSessionLocal() as db:
        # Monthly
        monthly = await db.scalar(
            select(UserUsage).where(
                UserUsage.user_id == user_id,
                UserUsage.year == now.year,
                UserUsage.month == now.month,
            )
        )
        if monthly:
            monthly.ai_chat_messages  += 1
            monthly.ai_input_tokens   += input_tokens
            monthly.ai_output_tokens  += output_tokens
            monthly.ai_cost_usd       += cost_usd
        else:
            db.add(UserUsage(
                user_id=user_id, year=now.year, month=now.month,
                ai_chat_messages=1,
                ai_input_tokens=input_tokens,
                ai_output_tokens=output_tokens,
                ai_cost_usd=cost_usd,
            ))

        # Daily
        daily = await db.scalar(
            select(DailyUsage).where(
                DailyUsage.user_id == user_id, DailyUsage.usage_date == today
            )
        )
        if daily:
            daily.ai_chat_messages += 1
        else:
            db.add(DailyUsage(
                user_id=user_id, usage_date=today, ai_chat_messages=1
            ))

        await db.commit()


# ── Chat Streaming Endpoint ────────────────────────────────────

@router.post("/chat")
async def ai_chat(
    body: ChatRequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """محادثة AI مع Streaming (SSE)"""
    await _check_ai_limit(db, user)

    plan = _get_plan_str(user)
    model_key = _choose_model(user, body.model)
    max_tokens = PLAN_LIMITS[plan]["max_message_tokens"]

    # ── استرجاع أو إنشاء المحادثة ──────────────────────────
    conv: Optional[AIConversation] = None
    if body.conversation_id:
        conv = await db.get(AIConversation, body.conversation_id)
        if not conv or conv.user_id != user.id:
            raise HTTPException(404, detail={"message": "المحادثة غير موجودة"})

    if not conv:
        conv = AIConversation(
            user_id=user.id,
            model_used=model_key,
            messages=json.dumps([]),
            scan_id=body.scan_id,
        )
        db.add(conv)
        await db.flush()

    # تحميل سجل الرسائل
    history: list[dict] = []
    if conv.messages:
        try:
            history = json.loads(conv.messages)
        except Exception:
            history = []

    # إضافة رسالة المستخدم
    history.append({"role": "user", "content": body.message})

    # الاحتفاظ بآخر N رسالة فقط
    trimmed = history[-MAX_HISTORY_MESSAGES:]

    # System prompt
    lang = "ar" if any(ord(c) > 0x600 for c in body.message) else "en"
    system_prompt = get_security_assistant_prompt(
        user_plan=plan,
        user_name=user.full_name or "",
        lang=lang,
    )

    # حفظ رسالة المستخدم + conv_id في قاعدة البيانات قبل البدء
    if not conv.title or conv.title == "محادثة جديدة":
        conv.title = body.message[:MAX_TITLE_LENGTH]
    conv.model_used = model_key
    conv.message_count += 1
    await db.commit()
    conv_id = conv.id

    # ── Streaming Generator ────────────────────────────────
    async def generate():
        full_text = ""
        final_meta = {}

        # أرسل conv_id أولاً
        yield f"data: {json.dumps({'conversation_id': conv_id})}\n\n"

        async for chunk in stream_chat(trimmed, model_key, max_tokens, system_prompt):
            if "text" in chunk:
                full_text += chunk["text"]
                yield f"data: {json.dumps({'text': chunk['text']})}\n\n"
            elif "done" in chunk:
                final_meta = chunk
                yield f"data: {json.dumps({'done': True})}\n\n"
            elif "error" in chunk:
                yield f"data: {json.dumps({'error': chunk['error']})}\n\n"
                return

        # بعد انتهاء الـ streaming: حدّث قاعدة البيانات
        input_t  = final_meta.get("input_tokens", 0)
        output_t = final_meta.get("output_tokens", 0)
        cost     = final_meta.get("cost_usd", 0.0)

        async with AsyncSessionLocal() as update_db:
            c = await update_db.get(AIConversation, conv_id)
            if c:
                updated_history = history + [{"role": "assistant", "content": full_text}]
                c.messages = json.dumps(updated_history[-50:])  # keep last 50
                c.total_input_tokens  += input_t
                c.total_output_tokens += output_t
                c.total_cost_usd      += cost
                c.message_count       += 1
                c.updated_at = datetime.now(timezone.utc)
                await update_db.commit()

        await _record_ai_usage(user.id, input_t, output_t, cost)

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ── Fix Wizard ────────────────────────────────────────────────

@router.post("/fix-wizard")
async def fix_wizard(
    body: FixWizardRequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """توليد توصية إصلاح مفصّلة لثغرة محددة (Streaming)"""
    await _check_ai_limit(db, user)

    plan  = _get_plan_str(user)
    model_key  = _choose_model(user, "sonnet")  # Fix Wizard يستخدم Sonnet دائماً
    max_tokens = 2048

    system_prompt = get_fix_wizard_prompt(
        body.finding_title,
        body.finding_description,
        body.evidence or "",
    )

    messages = [{"role": "user", "content": "Please provide the detailed fix."}]

    async def generate():
        input_t = output_t = 0
        cost = 0.0
        async for chunk in stream_chat(messages, model_key, max_tokens, system_prompt):
            if "text" in chunk:
                yield f"data: {json.dumps({'text': chunk['text']})}\n\n"
            elif "done" in chunk:
                input_t  = chunk.get("input_tokens", 0)
                output_t = chunk.get("output_tokens", 0)
                cost     = chunk.get("cost_usd", 0.0)
                yield f"data: {json.dumps({'done': True})}\n\n"
            elif "error" in chunk:
                yield f"data: {json.dumps({'error': chunk['error']})}\n\n"
                return
        await _record_ai_usage(user.id, input_t, output_t, cost)

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Scan Analysis ────────────────────────────────────────────

@router.post("/analyze-scan/{scan_id}")
async def analyze_scan(
    scan_id: int,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """تحليل نتائج الفحص بالذكاء الاصطناعي (Streaming)"""
    await _check_ai_limit(db, user)

    scan = await db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, detail={"message": "الفحص غير موجود"})
    if scan.status != "completed":
        raise HTTPException(400, detail={"message": "الفحص لم يكتمل بعد"})

    model_key = _choose_model(user, "sonnet")

    findings: list[dict] = []
    if scan.findings:
        try:
            findings = json.loads(scan.findings)
        except Exception:
            findings = []

    findings_summary = {
        "total":      scan.total_findings,
        "critical":   scan.critical_count,
        "high":       scan.high_count,
        "medium":     scan.medium_count,
        "low":        scan.low_count,
        "risk_score": scan.risk_score,
        "risk_level": scan.risk_level,
    }

    top_findings_text = "\n".join([
        f"- [{f.get('severity','').upper()}] {f.get('title_ar') or f.get('title','')}: {f.get('description','')[:180]}"
        for f in findings[:12]
    ])

    system_prompt = get_scan_analysis_prompt(scan.scan_type, findings_summary)

    user_message = f"""الهدف: {scan.target_display or scan.target}
نوع الفحص: {scan.scan_type}
درجة الخطر: {scan.risk_score}/100 ({scan.risk_level})

أبرز النتائج:
{top_findings_text or "لا توجد نتائج"}

قدّم تحليلاً أمنياً شاملاً باللغة العربية يشمل:
1. **ملخص تنفيذي** - وصف موجز للوضع الأمني العام
2. **أخطر المشكلات** - شرح للثغرات الحرجة والعالية وتأثيرها
3. **إجراءات فورية** - الخطوات الأولى التي يجب اتخاذها الآن
4. **تأثير على الامتثال** - ارتباط النتائج بمتطلبات NCA ECC أو SAMA CSF أو PDPL
5. **توصية ختامية** - ملاحظة ختامية للفريق التقني"""

    messages = [{"role": "user", "content": user_message}]

    async def generate():
        input_t = output_t = 0
        cost = 0.0
        async for chunk in stream_chat(messages, model_key, 2048, system_prompt):
            if "text" in chunk:
                yield f"data: {json.dumps({'text': chunk['text']})}\n\n"
            elif "done" in chunk:
                input_t  = chunk.get("input_tokens", 0)
                output_t = chunk.get("output_tokens", 0)
                cost     = chunk.get("cost_usd", 0.0)
                yield f"data: {json.dumps({'done': True})}\n\n"
            elif "error" in chunk:
                yield f"data: {json.dumps({'error': chunk['error']})}\n\n"
                return
        await _record_ai_usage(user.id, input_t, output_t, cost)

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Smart Search ──────────────────────────────────────────────

@router.post("/search")
async def ai_search(
    body: SearchRequest,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """بحث ذكي في قاعدة معرفة الأمن السيبراني (Streaming)"""
    await _check_ai_limit(db, user)

    plan      = _get_plan_str(user)
    model_key = _choose_model(user, "haiku")
    max_tokens = PLAN_LIMITS[plan]["max_message_tokens"]

    lang = "ar" if any(ord(c) > 0x600 for c in body.query) else "en"
    system_prompt = (
        "أنت محرك بحث متخصص في الأمن السيبراني للشركات السعودية والخليجية. "
        "عندما يبحث المستخدم عن موضوع أمني قدّم: تعريفاً واضحاً، أهم المخاطر، "
        "أفضل الممارسات، وارتباطه بمعايير NCA ECC/SAMA CSF/PDPL/ISO 27001 إن وجد. "
        "استخدم Markdown للتنسيق. أجب بلغة السؤال."
        if lang == "ar" else
        "You are a cybersecurity knowledge search engine. For any security topic provide: "
        "a clear definition, key risks, best practices, and relevant compliance standards "
        "(NCA ECC, SAMA CSF, PDPL, ISO 27001). Use Markdown. Answer in the query language."
    )

    messages = [{"role": "user", "content": body.query}]

    async def generate():
        input_t = output_t = 0
        cost = 0.0
        async for chunk in stream_chat(messages, model_key, max_tokens, system_prompt):
            if "text" in chunk:
                yield f"data: {json.dumps({'text': chunk['text']})}\n\n"
            elif "done" in chunk:
                input_t  = chunk.get("input_tokens", 0)
                output_t = chunk.get("output_tokens", 0)
                cost     = chunk.get("cost_usd", 0.0)
                yield f"data: {json.dumps({'done': True})}\n\n"
            elif "error" in chunk:
                yield f"data: {json.dumps({'error': chunk['error']})}\n\n"
                return
        await _record_ai_usage(user.id, input_t, output_t, cost)

    return StreamingResponse(generate(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ── Conversation History ──────────────────────────────────────

@router.get("/conversations")
async def list_conversations(
    limit:  int = Query(20, le=50),
    offset: int = Query(0),
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await db.execute(
        select(AIConversation)
        .where(AIConversation.user_id == user.id)
        .order_by(AIConversation.updated_at.desc())
        .offset(offset).limit(limit)
    )
    convs = rows.scalars().all()
    return {"conversations": [_serialize_conv(c) for c in convs]}


@router.get("/conversations/{conv_id}")
async def get_conversation(
    conv_id: int,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(AIConversation, conv_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(404, detail={"message": "المحادثة غير موجودة"})
    return _serialize_conv(conv, include_messages=True)


@router.delete("/conversations/{conv_id}")
async def delete_conversation(
    conv_id: int,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    conv = await db.get(AIConversation, conv_id)
    if not conv or conv.user_id != user.id:
        raise HTTPException(404)
    db.delete(conv)
    await db.commit()
    return {"success": True}


def _serialize_conv(c: AIConversation, include_messages: bool = False) -> dict:
    data = {
        "id": c.id,
        "title": c.title,
        "model_used": c.model_used,
        "message_count": c.message_count,
        "total_cost_usd": round(c.total_cost_usd, 6),
        "scan_id": c.scan_id,
        "created_at": c.created_at.isoformat(),
        "updated_at": c.updated_at.isoformat(),
    }
    if include_messages:
        try:
            data["messages"] = json.loads(c.messages) if c.messages else []
        except Exception:
            data["messages"] = []
    return data
