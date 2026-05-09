"""
Compliance API — تحليل الامتثال للمعايير الأمنية السعودية
NCA ECC · SAMA CSF · PDPL
"""
import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_active_user
from app.core.ai.client import stream_chat
from app.core.compliance.nca_ecc import analyze_nca_ecc
from app.core.compliance.sama_csf import analyze_sama_csf
from app.core.compliance.pdpl import analyze_pdpl
from app.models.user import User
from app.models.scan import Scan

router = APIRouter(prefix="/compliance", tags=["Compliance"])


# ── Request Models ───────────────────────────────────────────────

class AIAnalysisRequest(BaseModel):
    scan_id: int
    frameworks: list[str] = ["nca_ecc", "sama_csf", "pdpl"]


# ── Helpers ──────────────────────────────────────────────────────

def _plan_str(user: User) -> str:
    return user.plan.value if hasattr(user.plan, "value") else str(user.plan)


def _build_compliance_context(reports: dict) -> str:
    """Build a text summary of compliance gaps for the AI prompt."""
    lines = []
    for fw_key, report in reports.items():
        lines.append(f"\n### {report['name_ar']} — نقاط: {report['score']}/100")
        gaps = [i for i in report["items"] if i["status"] == "non_compliant"]
        partials = [i for i in report["items"] if i["status"] == "partial"]
        if gaps:
            lines.append(f"**غير ممتثل ({len(gaps)} متطلب):**")
            for g in gaps:
                lines.append(f"  - [{g['id']}] {g['title_ar']}: {', '.join(g['findings'][:2])}")
        if partials:
            lines.append(f"**امتثال جزئي ({len(partials)} متطلب):**")
            for p in partials:
                lines.append(f"  - [{p['id']}] {p['title_ar']}")
    return "\n".join(lines)


# ── Endpoints ────────────────────────────────────────────────────

@router.get("/scan/{scan_id}")
async def get_scan_compliance(
    scan_id: int,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """تحليل نتائج الفحص مقابل المعايير الثلاثة (NCA ECC · SAMA CSF · PDPL)"""
    scan = await db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, detail={"message": "الفحص غير موجود"})
    if scan.status != "completed":
        raise HTTPException(400, detail={"message": "الفحص لم يكتمل بعد"})

    findings: list[dict] = []
    if scan.findings:
        try:
            findings = json.loads(scan.findings)
        except Exception:
            findings = []

    scan_type = scan.scan_type

    nca_report  = analyze_nca_ecc(findings, scan_type)
    sama_report = analyze_sama_csf(findings, scan_type)
    pdpl_report = analyze_pdpl(findings, scan_type)

    overall_score = round(
        (nca_report.score + sama_report.score + pdpl_report.score) / 3
    )

    return {
        "scan_id": scan_id,
        "scan_type": scan_type,
        "target": scan.target_display or scan.target,
        "overall_score": overall_score,
        "frameworks": {
            "nca_ecc":  nca_report.to_dict(),
            "sama_csf": sama_report.to_dict(),
            "pdpl":     pdpl_report.to_dict(),
        },
    }


@router.get("/frameworks")
async def list_frameworks(_: User = Depends(get_active_user)):
    """قائمة الأطر التنظيمية المدعومة"""
    return {
        "frameworks": [
            {
                "key": "nca_ecc",
                "name_ar": "الضوابط الأساسية للأمن السيبراني (NCA ECC)",
                "authority": "الهيئة الوطنية للأمن السيبراني",
                "year": "2018",
            },
            {
                "key": "sama_csf",
                "name_ar": "إطار عمل الأمن السيبراني لساما (SAMA CSF)",
                "authority": "مؤسسة النقد العربي السعودي",
                "year": "2017",
            },
            {
                "key": "pdpl",
                "name_ar": "نظام حماية البيانات الشخصية (PDPL)",
                "authority": "هيئة حماية البيانات الشخصية",
                "year": "2021",
            },
        ]
    }


@router.post("/ai-analysis/{scan_id}")
async def compliance_ai_analysis(
    scan_id: int,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """تحليل فجوات الامتثال بالذكاء الاصطناعي (Streaming)"""
    from app.core.config import PLAN_LIMITS
    from app.core.ai.client import stream_chat
    from app.api.v1.ai import _check_ai_limit, _choose_model, _record_ai_usage

    await _check_ai_limit(db, user)

    scan = await db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, detail={"message": "الفحص غير موجود"})
    if scan.status != "completed":
        raise HTTPException(400, detail={"message": "الفحص لم يكتمل بعد"})

    findings: list[dict] = []
    if scan.findings:
        try:
            findings = json.loads(scan.findings)
        except Exception:
            findings = []

    scan_type = scan.scan_type
    nca_report  = analyze_nca_ecc(findings, scan_type).to_dict()
    sama_report = analyze_sama_csf(findings, scan_type).to_dict()
    pdpl_report = analyze_pdpl(findings, scan_type).to_dict()

    compliance_context = _build_compliance_context({
        "nca_ecc": nca_report,
        "sama_csf": sama_report,
        "pdpl": pdpl_report,
    })

    model_key  = _choose_model(user, "sonnet")
    system_prompt = """أنت مستشار امتثال متخصص في المعايير الأمنية السعودية والخليجية.
مهمتك: تحليل فجوات الامتثال وتقديم خطة عمل عملية ومحددة.
الأطر المرجعية: NCA ECC (الضوابط الأساسية)، SAMA CSF (إطار ساما)، PDPL (نظام البيانات الشخصية).
اكتب بالعربية، استخدم Markdown، وكن محدداً وعملياً."""

    user_message = f"""الهدف: {scan.target_display or scan.target}
نوع الفحص: {scan_type}
درجة المخاطر: {scan.risk_score}/100

نتائج الامتثال:
{compliance_context}

قدّم تحليلاً شاملاً لفجوات الامتثال يشمل:
1. **ملخص حالة الامتثال** - تقييم عام للوضع الامتثالي عبر المعايير الثلاثة
2. **الفجوات الحرجة** - المتطلبات غير الممتثلة ذات الأولوية القصوى مع تأثيرها القانوني والأمني
3. **خطة العلاج** - إجراءات مرتبة بالأولوية (فورية / قصيرة المدى / بعيدة المدى)
4. **المخاطر القانونية** - العواقب المحتملة عند عدم الامتثال (غرامات NCA، متطلبات PDPL)
5. **التوصيات التقنية** - خطوات تقنية محددة لسد الفجوات"""

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
