"""
Scans API — إنشاء وإدارة الفحوصات الأمنية
"""
import asyncio
import json

SCAN_TIMEOUT_SECONDS = 120  # حد أقصى دقيقتان لكل فحص
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, WebSocket, WebSocketDisconnect, UploadFile, File
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db, AsyncSessionLocal
from app.core.deps import get_active_user, get_current_user
from app.core.usage_limiter import UsageLimiter
from app.models.scan import Scan
from app.models.user import User

router = APIRouter(prefix="/scans", tags=["Scans"])

ALLOWED_SCAN_TYPES = {"url", "domain", "file", "api", "github", "email"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


# ── Request Body ────────────────────────────────────────────────

class CreateScanRequest(BaseModel):
    scan_type: str
    target: str
    extra: Optional[str] = None  # e.g. auth header for API scan


# ── الفحص في الخلفية ─────────────────────────────────────────────

async def _run_scan(scan_id: int, scan_type: str, target: str, extra: Optional[str] = None) -> None:
    """يشتغل في Background Task — يُحدّث الـ DB مع التقدم"""
    async with AsyncSessionLocal() as db:
        scan = await db.get(Scan, scan_id)
        if not scan:
            return

        scan.status = "running"
        scan.started_at = datetime.now(timezone.utc)
        await db.commit()

        start_ms = datetime.now(timezone.utc).timestamp() * 1000

        try:
            result = None

            async def progress_cb(pct: int, msg: str):
                async with AsyncSessionLocal() as _db:
                    s = await _db.get(Scan, scan_id)
                    if s:
                        s.summary = json.dumps({"progress": pct, "message": msg})
                        await _db.commit()

            async def _do_scan():
                if scan_type == "url":
                    from app.core.scanner.url_scanner import scan_url
                    return await scan_url(target, progress_cb=progress_cb)
                elif scan_type in ("domain", "email"):
                    from app.core.scanner.domain_scanner import scan_domain
                    return await scan_domain(target, progress_cb=progress_cb)
                elif scan_type == "api":
                    from app.core.scanner.api_scanner import scan_api
                    return await scan_api(target, auth_header=extra, progress_cb=progress_cb)
                elif scan_type == "github":
                    from app.core.scanner.github_scanner import scan_github
                    return await scan_github(target, progress_cb=progress_cb)
                elif scan_type == "file":
                    if "|||" in target:
                        filename, content = target.split("|||", 1)
                    else:
                        filename, content = "unknown.txt", target
                    from app.core.scanner.file_scanner import scan_file
                    return await scan_file(filename, content, progress_cb=progress_cb)
                else:
                    raise ValueError(f"Unsupported scan_type: {scan_type}")

            result = await asyncio.wait_for(_do_scan(), timeout=SCAN_TIMEOUT_SECONDS)

            # تحديث DB بالنتائج
            scan = await db.get(Scan, scan_id)
            if scan:
                scan.status = "completed" if not result.error else "failed"
                scan.error_msg = result.error
                scan.risk_score = result.risk_score
                scan.risk_level = result.risk_level
                scan.findings = json.dumps([
                    {
                        "severity": f.severity,
                        "category": f.category,
                        "title": f.title,
                        "title_ar": f.title_ar,
                        "description": f.description,
                        "recommendation": f.recommendation,
                        "evidence": f.evidence,
                        "cwe_id": f.cwe_id,
                        "cvss_score": f.cvss_score,
                        "attack_scenario": f.attack_scenario,
                    }
                    for f in result.findings
                ])
                scan.summary = json.dumps(result.summary)
                scan.total_findings   = result.summary.get("total", 0)
                scan.critical_count   = result.summary.get("critical", 0)
                scan.high_count       = result.summary.get("high", 0)
                scan.medium_count     = result.summary.get("medium", 0)
                scan.low_count        = result.summary.get("low", 0)
                scan.info_count       = result.summary.get("info", 0)
                scan.completed_at     = datetime.now(timezone.utc)
                scan.duration_ms      = int(datetime.now(timezone.utc).timestamp() * 1000 - start_ms)
                await db.commit()

        except asyncio.TimeoutError:
            scan = await db.get(Scan, scan_id)
            if scan:
                scan.status = "failed"
                scan.error_msg = f"انتهت مهلة الفحص ({SCAN_TIMEOUT_SECONDS}s) — الهدف لا يستجيب أو بطيء جداً"
                scan.completed_at = datetime.now(timezone.utc)
                await db.commit()

        except Exception as e:
            scan = await db.get(Scan, scan_id)
            if scan:
                scan.status = "failed"
                scan.error_msg = str(e)[:500]
                scan.completed_at = datetime.now(timezone.utc)
                await db.commit()


# ── REST Endpoints ───────────────────────────────────────────────

@router.post("/")
async def create_scan(
    body: CreateScanRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """إنشاء فحص جديد — يُشغَّل في الخلفية"""
    if body.scan_type not in ALLOWED_SCAN_TYPES:
        raise HTTPException(400, detail={"message": f"نوع الفحص غير مدعوم: {body.scan_type}"})

    target = body.target.strip()
    if not target:
        raise HTTPException(400, detail={"message": "الهدف لا يمكن أن يكون فارغاً"})

    # فحص حد الاستهلاك
    try:
        check = await UsageLimiter.check_scan(db, user)
    except Exception as e:
        import traceback
        raise HTTPException(500, detail={"message": f"check_scan error: {type(e).__name__}: {str(e)[:200]}", "trace": traceback.format_exc()[-500:]})
    if not check.allowed:
        raise HTTPException(429, detail={"message": check.message_ar, "reason": check.reason})

    # سجّل الاستهلاك
    try:
        await UsageLimiter.record_scan(db, user.id, body.scan_type)
    except Exception as e:
        import traceback
        raise HTTPException(500, detail={"message": f"record_scan error: {type(e).__name__}: {str(e)[:200]}", "trace": traceback.format_exc()[-500:]})

    # إنشاء سجل الفحص
    display = target[:100]
    scan = Scan(
        user_id=user.id,
        scan_type=body.scan_type,
        target=target,
        target_display=display,
        status="queued",
    )
    try:
        db.add(scan)
        await db.commit()
        await db.refresh(scan)
    except Exception as e:
        import traceback
        raise HTTPException(500, detail={"message": f"scan commit error: {type(e).__name__}: {str(e)[:200]}", "trace": traceback.format_exc()[-500:]})

    # شغّل الفحص في الخلفية
    background_tasks.add_task(_run_scan, scan.id, body.scan_type, target, body.extra or None)

    return {
        "success": True,
        "scan_id": scan.id,
        "status": "queued",
        "message": "تم إنشاء الفحص وهو قيد التشغيل",
    }


@router.post("/upload")
async def upload_file_scan(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """رفع ملف وفحصه أمنياً"""
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(413, detail={"message": "حجم الملف يتجاوز الحد المسموح (5MB)"})

    check = await UsageLimiter.check_scan(db, user)
    if not check.allowed:
        raise HTTPException(429, detail={"message": check.message_ar, "reason": check.reason})
    await UsageLimiter.record_scan(db, user.id, "file")

    try:
        raw = await file.read()
        # Try UTF-8 decode, fall back to latin-1
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError:
            content = raw.decode("latin-1")
    except Exception:
        raise HTTPException(400, detail={"message": "تعذّر قراءة الملف"})

    filename = file.filename or "unknown"
    target = f"{filename}|||{content[:500_000]}"  # max 500KB content stored

    scan = Scan(
        user_id=user.id,
        scan_type="file",
        target=target,
        target_display=filename,
        status="queued",
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    background_tasks.add_task(_run_scan, scan.id, "file", target)

    return {"success": True, "scan_id": scan.id, "status": "queued", "filename": filename}


@router.get("/")
async def list_scans(
    scan_type: Optional[str] = Query(None),
    status: Optional[str]    = Query(None),
    limit:  int = Query(20, le=100),
    offset: int = Query(0),
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """قائمة فحوصات المستخدم"""
    q = select(Scan).where(Scan.user_id == user.id).order_by(Scan.created_at.desc())
    if scan_type: q = q.where(Scan.scan_type == scan_type)
    if status:    q = q.where(Scan.status == status)

    rows = await db.execute(q.offset(offset).limit(limit))
    scans = rows.scalars().all()

    from sqlalchemy import func
    total = await db.scalar(
        select(func.count(Scan.id)).where(Scan.user_id == user.id)
    ) or 0

    return {
        "total": total,
        "scans": [_serialize_scan(s) for s in scans],
    }


@router.get("/{scan_id}")
async def get_scan(
    scan_id: int,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    """تفاصيل فحص واحد"""
    scan = await db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, detail={"message": "الفحص غير موجود"})
    return _serialize_scan(scan, include_findings=True)


@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: int,
    user: User = Depends(get_active_user),
    db: AsyncSession = Depends(get_db),
):
    scan = await db.get(Scan, scan_id)
    if not scan or scan.user_id != user.id:
        raise HTTPException(404, detail={"message": "الفحص غير موجود"})
    await db.delete(scan)
    await db.commit()
    return {"success": True}


# ── WebSocket Progress ──────────────────────────────────────────

@router.websocket("/{scan_id}/progress")
async def scan_progress_ws(
    websocket: WebSocket,
    scan_id: int,
    token: Optional[str] = Query(None),
):
    """
    WebSocket لمتابعة تقدم الفحص لحظةً بلحظة.
    يُرسل تحديثاً كل ثانية حتى ينتهي الفحص.
    """
    await websocket.accept()

    # التحقق من الـ token
    user = None
    if token:
        try:
            from app.core.security import decode_token
            from app.core.database import AsyncSessionLocal
            payload = decode_token(token)
            user_id = int(payload.get("sub", 0))
            async with AsyncSessionLocal() as db:
                user = await db.get(User, user_id)
        except Exception:
            pass

    if not user:
        await websocket.close(code=1008, reason="unauthorized")
        return

    try:
        while True:
            async with AsyncSessionLocal() as db:
                scan = await db.get(Scan, scan_id)

            if not scan or scan.user_id != user.id:
                await websocket.send_json({"error": "not_found"})
                break

            summary = {}
            if scan.summary:
                try:
                    summary = json.loads(scan.summary)
                except Exception:
                    pass

            payload = {
                "scan_id": scan_id,
                "status": scan.status,
                "progress": summary.get("progress", 0) if scan.status == "running" else (100 if scan.status == "completed" else 0),
                "message": summary.get("message", ""),
                "risk_score": scan.risk_score,
                "risk_level": scan.risk_level,
                "total_findings": scan.total_findings,
                "critical_count": scan.critical_count,
                "high_count": scan.high_count,
                "medium_count": scan.medium_count,
            }

            await websocket.send_json(payload)

            if scan.status in ("completed", "failed"):
                break

            await asyncio.sleep(1)

    except WebSocketDisconnect:
        pass


# ── Serializer ──────────────────────────────────────────────────

def _serialize_scan(s: Scan, include_findings: bool = False) -> dict:
    data = {
        "id": s.id,
        "scan_type": s.scan_type,
        "target": s.target_display or s.target,
        "status": s.status,
        "risk_score": s.risk_score,
        "risk_level": s.risk_level,
        "total_findings": s.total_findings,
        "critical_count": s.critical_count,
        "high_count": s.high_count,
        "medium_count": s.medium_count,
        "low_count": s.low_count,
        "info_count": s.info_count,
        "duration_ms": s.duration_ms,
        "error_msg": s.error_msg,
        "started_at": s.started_at.isoformat() if s.started_at else None,
        "completed_at": s.completed_at.isoformat() if s.completed_at else None,
        "created_at": s.created_at.isoformat(),
    }
    if include_findings:
        try:
            data["findings"] = json.loads(s.findings) if s.findings else []
            data["summary"]  = json.loads(s.summary)  if s.summary  else {}
        except Exception:
            data["findings"] = []
            data["summary"]  = {}
    return data
