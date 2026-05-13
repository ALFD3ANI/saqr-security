"""
URL/Web Scanner — فحص المواقع الإلكترونية
يفحص: SSL، Security Headers، المحتوى، إعادة التوجيه، الملفات الحساسة
"""
import asyncio
import ssl
import socket
import re
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx

from .base import Finding, ScanResult

# ── constants ─────────────────────────────────────────────────
_HTTP_TIMEOUT  = 8.0
_PATH_TIMEOUT  = 3.0
_SSL_TIMEOUT   = 6.0
_DNS_TIMEOUT   = 5.0

# ── required headers ──────────────────────────────────────────
REQUIRED_HEADERS = {
    "strict-transport-security": {
        "title":          "Missing HSTS Header",
        "title_ar":       "غياب ترويسة HSTS",
        "severity":       "high",
        "cwe_id":         "CWE-319",
        "description":    "HTTP Strict Transport Security غير مضبوط — المتصفح قد يتصل عبر HTTP غير مشفّر.",
        "recommendation": "أضف: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
        "attack_scenario":"يمكن للمهاجم تنفيذ هجوم SSL Stripping: يعترض الاتصال بين المتصفح والخادم ويجبره على استخدام HTTP بدلاً من HTTPS، مما يتيح قراءة بيانات المستخدمين كالكلمات السرية ومعلومات الدفع بالنص الواضح دون تشفير.",
    },
    "content-security-policy": {
        "title":          "Missing Content Security Policy",
        "title_ar":       "غياب سياسة أمان المحتوى (CSP)",
        "severity":       "high",
        "cwe_id":         "CWE-1021",
        "description":    "لا توجد ترويسة CSP — الموقع عرضة لهجمات XSS وحقن البيانات.",
        "recommendation": "أضف ترويسة Content-Security-Policy تحدد المصادر المسموح بها للسكريبت والصور والخطوط.",
        "attack_scenario":"يمكن للمهاجم حقن سكريبت JavaScript ضار في الصفحة (XSS) عبر حقل إدخال أو رابط مزوّر، فيسرق جلسة المستخدم (session cookies) أو يعيد توجيهه لموقع تصيّد، أو يسجّل ما يكتبه (keylogger).",
    },
    "x-frame-options": {
        "title":          "Missing X-Frame-Options",
        "title_ar":       "غياب ترويسة X-Frame-Options",
        "severity":       "medium",
        "cwe_id":         "CWE-1021",
        "description":    "يمكن تضمين الموقع داخل iframe مما يفتح باب هجوم Clickjacking.",
        "recommendation": "أضف: X-Frame-Options: DENY  أو  X-Frame-Options: SAMEORIGIN",
        "attack_scenario":"يضع المهاجم الموقع الحقيقي داخل iframe شفاف فوق صفحة مزيّفة؛ المستخدم يعتقد أنه ينقر على شيء بسيط لكنه فعلياً يضغط على زر تأكيد دفع أو نقل أموال أو تغيير كلمة مرور في الموقع الأصلي.",
    },
    "x-content-type-options": {
        "title":          "Missing X-Content-Type-Options",
        "title_ar":       "غياب ترويسة X-Content-Type-Options",
        "severity":       "medium",
        "cwe_id":         "CWE-16",
        "description":    "المتصفح قد يُخمِّن نوع المحتوى (MIME Sniffing) مما قد يُشغِّل محتوى ضاراً.",
        "recommendation": "أضف: X-Content-Type-Options: nosniff",
        "attack_scenario":"يرفع المهاجم ملف يبدو صورة لكنه يحتوي HTML/JS؛ المتصفح يكتشف النوع بنفسه ويُنفِّذه كصفحة ويب، مما قد يُطلِق هجوم XSS أو تنزيل ملفات ضارة.",
    },
    "referrer-policy": {
        "title":          "Missing Referrer-Policy",
        "title_ar":       "غياب ترويسة Referrer-Policy",
        "severity":       "low",
        "cwe_id":         "CWE-200",
        "description":    "معلومات المصدر (Referrer) قد تتسرّب لمواقع خارجية.",
        "recommendation": "أضف: Referrer-Policy: strict-origin-when-cross-origin",
        "attack_scenario":"عندما ينتقل المستخدم من صفحة حساسة (مثل صفحة دفع تحتوي رمز الطلب في URL) إلى رابط خارجي، يرى الموقع الخارجي الـ URL الكامل في Referrer header، مما قد يكشف بيانات خاصة.",
    },
    "permissions-policy": {
        "title":          "Missing Permissions-Policy",
        "title_ar":       "غياب ترويسة Permissions-Policy",
        "severity":       "low",
        "cwe_id":         "CWE-16",
        "description":    "صلاحيات المتصفح (كاميرا، ميكروفون، موقع) غير مقيّدة.",
        "recommendation": "أضف: Permissions-Policy: geolocation=(), microphone=(), camera=()",
        "attack_scenario":"إذا نجح مهاجم في حقن سكريبت ضار بالموقع، يستطيع طلب إذن الكاميرا أو الميكروفون أو الموقع الجغرافي دون قيود من الموقع نفسه، مما قد يتيح التجسس على المستخدم.",
    },
}

DANGEROUS_HEADERS = {
    "server": {
        "title":          "Server Version Disclosure",
        "title_ar":       "كشف إصدار الخادم",
        "severity":       "medium",
        "cwe_id":         "CWE-200",
        "description":    "ترويسة Server تكشف نوع وإصدار برنامج خادم الويب.",
        "recommendation": "احذف أو عدّل ترويسة Server في إعدادات خادم الويب.",
        "attack_scenario":"يستخدم المهاجم الإصدار المكشوف للبحث في قواعد CVE عن ثغرات معروفة خاصة بهذا الإصدار (مثل ثغرات Apache أو Nginx قديمة) ثم يشنّ هجوماً موجّهاً باستغلال الثغرة مباشرة.",
    },
    "x-powered-by": {
        "title":          "Technology Disclosure via X-Powered-By",
        "title_ar":       "كشف التقنية عبر X-Powered-By",
        "severity":       "low",
        "cwe_id":         "CWE-200",
        "description":    "X-Powered-By يكشف التقنية المستخدمة في الخلفية (PHP، Node.js، إلخ).",
        "recommendation": "احذف ترويسة X-Powered-By من إعدادات التطبيق.",
        "attack_scenario":"معرفة التقنية والإصدار (مثلاً PHP/7.2.0) يمكّن المهاجم من استهداف ثغرات موثّقة لهذا الإصدار تحديداً، خاصة إذا لم تُطبَّق التحديثات الأمنية.",
    },
    "x-aspnet-version": {
        "title":          "ASP.NET Version Disclosure",
        "title_ar":       "كشف إصدار ASP.NET",
        "severity":       "medium",
        "cwe_id":         "CWE-200",
        "description":    "إصدار ASP.NET مكشوف، مما يساعد المهاجمين على استهداف ثغرات محددة.",
        "recommendation": "أضف في Web.config: <httpRuntime enableVersionHeader=\"false\" />",
        "attack_scenario":"الإصدارات القديمة من ASP.NET تحتوي ثغرات View State Tampering وPadding Oracle Attack التي تسمح بتنفيذ كود على الخادم، وكشف الإصدار يعطي المهاجم نقطة بداية.",
    },
}

SENSITIVE_CONTENT_PATTERNS = [
    (r"password\s*=\s*['\"][^'\"]{4,}['\"]",                 "high",     "Password in Response Body",     "كلمة مرور في محتوى الصفحة",
     "المهاجم يحصل مباشرة على كلمة مرور صالحة يمكنه استخدامها للدخول للنظام أو لهجمات Credential Stuffing على خدمات أخرى."),
    (r"api[_-]?key\s*[=:]\s*['\"][a-z0-9]{16,}['\"]",        "high",     "API Key Exposed in HTML",       "مفتاح API مكشوف في الكود",
     "المهاجم يستخدم المفتاح للوصول لخدمات خارجية (كـ AWS، Stripe، Twilio) باسم الشركة وعلى حسابها، مما قد يكلف مبالغ طائلة أو يتيح تسريب البيانات."),
    (r"access_token\s*[=:]\s*['\"][^'\"]{16,}['\"]",          "high",     "Access Token in HTML",          "رمز وصول مكشوف في الكود",
     "رمز الوصول يمنح المهاجم صلاحيات كاملة دون الحاجة لكلمة مرور — يستطيع الوصول للبيانات والخدمات المرتبطة حتى تنتهي صلاحية الرمز."),
    (r"<!--.*?(todo|fixme|hack|bug|xxx).*?-->",                "low",      "Developer Comments Found",      "تعليقات المطور في الكود",
     "تعليقات المطورين تكشف نقاط ضعف معروفة أو ميزات غير مكتملة أو بيانات حساسة قرر المطور إزالتها لاحقاً — كنز معلوماتي للمهاجم."),
    (r"(?:stack trace|traceback|exception at)",                "high",     "Error/Stack Trace Exposed",     "كشف Stack Trace للخادم",
     "Stack Trace يكشف بنية الكود الداخلية، ومسارات الملفات، وإصدارات المكتبات — مما يعطي المهاجم خارطة تفصيلية لإيجاد ثغرات محددة في الكود."),
    (r"(?:phpinfo|<\?php)",                                    "critical", "PHP Info Page Detected",        "صفحة phpinfo مكشوفة",
     "phpinfo() تكشف إعدادات PHP الكاملة، مسارات النظام، متغيرات البيئة، وإعدادات قاعدة البيانات — مما يعطي المهاجم كل ما يحتاجه لاختراق كامل للخادم."),
    (r"(?:mysql_error|pg_last_error|ORA-\d{5})",               "critical", "Database Error Exposed",        "خطأ قاعدة بيانات مكشوف",
     "رسائل أخطاء قاعدة البيانات تكشف بنية الجداول والأعمدة — مما يمكّن المهاجم من تنفيذ هجوم SQL Injection مدروس ودقيق لسرقة أو تعديل البيانات."),
    (r"(?:eval\(|document\.write\(|\.innerHTML\s*=)",          "medium",   "Potentially Unsafe JS",         "JavaScript غير آمن محتمل",
     "استخدام eval() أو innerHTML مع بيانات غير مُعقَّمة يُشكّل نقطة دخول مباشرة لـ DOM-based XSS، مما يسمح للمهاجم بتشغيل كوده في سياق الصفحة."),
]

SUSPICIOUS_PATHS = [
    "/.git/HEAD", "/.env", "/wp-admin/", "/phpmyadmin/",
    "/.htaccess", "/config.php",
]


async def scan_url(url: str, progress_cb=None) -> ScanResult:
    result = ScanResult()

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed   = urlparse(url)
    hostname = parsed.hostname or ""

    # ── 1. DNS ────────────────────────────────────────────────
    if progress_cb: await progress_cb(10, "Resolving DNS...")
    try:
        loop = asyncio.get_running_loop()
        ip_address = await asyncio.wait_for(
            loop.run_in_executor(None, socket.gethostbyname, hostname),
            timeout=_DNS_TIMEOUT,
        )
    except asyncio.TimeoutError:
        result.error = f"انتهت مهلة حل DNS للنطاق: {hostname}"
        result.risk_score = 0; result.risk_level = "unknown"
        return result
    except (socket.gaierror, OSError):
        result.error = f"لم يتم العثور على النطاق: {hostname} — تأكد من صحة العنوان"
        result.risk_score = 0; result.risk_level = "unknown"
        return result

    # ── 2. SSL ────────────────────────────────────────────────
    if progress_cb: await progress_cb(20, "Checking SSL/TLS...")
    if url.startswith("https://"):
        loop = asyncio.get_running_loop()
        try:
            await asyncio.wait_for(
                loop.run_in_executor(None, _check_ssl, hostname, result),
                timeout=_SSL_TIMEOUT + 2,
            )
        except asyncio.TimeoutError:
            pass
    else:
        result.findings.append(Finding(
            severity="critical", category="ssl",
            title="No HTTPS",
            title_ar="الموقع لا يستخدم HTTPS",
            description="الموقع يُقدَّم عبر HTTP غير مشفّر — كل البيانات المُرسَلة مكشوفة.",
            recommendation="فعّل HTTPS بشهادة TLS صالحة (Let's Encrypt مجاني).",
            attack_scenario="أي شخص على نفس الشبكة (Wi-Fi عام، مزود الإنترنت) يستطيع قراءة أو تعديل كل البيانات المتبادلة بين المستخدم والموقع بالنص الواضح — بما فيها كلمات المرور وأرقام البطاقات.",
            cwe_id="CWE-319",
        ))

    # ── 3. HTTP Request ───────────────────────────────────────
    if progress_cb: await progress_cb(35, "Fetching HTTP headers...")
    response     = None
    final_url    = url
    redirect_chain: list[str] = []

    try:
        async with httpx.AsyncClient(
            timeout=_HTTP_TIMEOUT,
            follow_redirects=True,
            verify=False,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SaqrScanner/1.0)"},
        ) as client:
            resp          = await client.get(url)
            response      = resp
            final_url     = str(resp.url)
            redirect_chain = [str(h.url) for h in resp.history]

    except httpx.TimeoutException:
        result.findings.append(Finding(
            severity="info", category="network",
            title="Slow Response / Timeout",
            title_ar="استجابة بطيئة أو انتهاء المهلة",
            description=f"الخادم لم يستجب خلال {_HTTP_TIMEOUT}s — قد يكون بطيئاً أو يحجب الفحص الآلي.",
            recommendation="تحقق من أداء الخادم. بعض المواقع تحجب طلبات السكانر.",
            attack_scenario="الخادم البطيء يُسهِّل هجمات Denial of Service (DoS) — عدد محدود من الطلبات قد يُربِك الخادم ويجعله غير متاح للمستخدمين الحقيقيين.",
        ))
    except httpx.ConnectError:
        result.findings.append(Finding(
            severity="medium", category="network",
            title="Connection Refused / Blocked",
            title_ar="رفض الاتصال أو محجوب",
            description=f"تعذّر الاتصال بـ {hostname} من خادم الفحص. قد يحجب الموقع عناوين IP لمزودي السحابة.",
            recommendation="تأكد من إمكانية الوصول للموقع من الإنترنت العام.",
            attack_scenario="إذا كان الخادم يقبل اتصالات من مصادر محددة فقط، فالمهاجم يستخدم شبكة مختلفة أو VPN لتجاوز هذا القيد.",
        ))
    except Exception as e:
        err = str(e)
        if "ssl" in err.lower() or "certificate" in err.lower():
            result.findings.append(Finding(
                severity="high", category="ssl",
                title="SSL Connection Error",
                title_ar="خطأ في اتصال SSL",
                description=f"فشل الاتصال الآمن: {err[:150]}",
                recommendation="تحقق من صحة شهادة SSL وإعدادات TLS.",
                attack_scenario="خطأ SSL يعني أن الشهادة إما منتهية أو من جهة غير موثوقة — المهاجم يستطيع تنفيذ Man-in-the-Middle وتقديم شهادة مزيّفة لاعتراض الاتصالات.",
                cwe_id="CWE-295",
            ))
        else:
            result.error = f"تعذّر الاتصال: {err[:200]}"
            result.risk_score = 0; result.risk_level = "unknown"
            return result

    # ── 4. Redirects ──────────────────────────────────────────
    if progress_cb: await progress_cb(45, "Analyzing redirects...")
    if redirect_chain:
        if any("http://" in r for r in redirect_chain):
            result.findings.append(Finding(
                severity="medium", category="ssl",
                title="HTTP Redirect in Chain",
                title_ar="إعادة توجيه عبر HTTP غير مشفّر",
                description="سلسلة إعادة التوجيه تمر عبر HTTP غير مشفّر.",
                recommendation="تأكد من أن جميع عمليات إعادة التوجيه تستخدم HTTPS.",
                attack_scenario="في اللحظة التي تمر فيها الطلبات عبر HTTP، يستطيع المهاجم اعتراض البيانات الحساسة أو حقن محتوى ضار قبل أن يصل للنسخة المشفّرة.",
                cwe_id="CWE-319",
                evidence=" → ".join(redirect_chain[:5]),
            ))
        if len(redirect_chain) > 3:
            result.findings.append(Finding(
                severity="low", category="network",
                title="Excessive Redirects",
                title_ar="سلسلة إعادة توجيه طويلة",
                description=f"الموقع يعيد التوجيه {len(redirect_chain)} مرات.",
                recommendation="قلّل عمليات إعادة التوجيه.",
                attack_scenario="سلاسل إعادة التوجيه الطويلة تُستغَل أحياناً لإخفاء الوجهة الحقيقية عن المستخدم (Open Redirect) مما يُسهِّل هجمات التصيّد.",
                evidence=f"{len(redirect_chain)} hops",
            ))

    # ── 5. Security Headers ────────────────────────────────────
    if progress_cb: await progress_cb(55, "Checking security headers...")
    if response:
        hl = {k.lower(): v for k, v in response.headers.items()}

        for hname, meta in REQUIRED_HEADERS.items():
            if hname not in hl:
                result.findings.append(Finding(
                    severity=meta["severity"], category="headers",
                    title=meta["title"], title_ar=meta["title_ar"],
                    description=meta["description"],
                    recommendation=meta["recommendation"],
                    attack_scenario=meta.get("attack_scenario"),
                    cwe_id=meta.get("cwe_id"),
                ))

        for hname, meta in DANGEROUS_HEADERS.items():
            if hname in hl:
                result.findings.append(Finding(
                    severity=meta["severity"], category="headers",
                    title=meta["title"], title_ar=meta["title_ar"],
                    description=meta["description"],
                    recommendation=meta["recommendation"],
                    attack_scenario=meta.get("attack_scenario"),
                    cwe_id=meta.get("cwe_id"),
                    evidence=f"{hname}: {hl[hname][:100]}",
                ))

        csp = hl.get("content-security-policy", "")
        if csp:
            if "unsafe-inline" in csp:
                result.findings.append(Finding(
                    severity="medium", category="headers",
                    title="CSP Allows unsafe-inline",
                    title_ar="سياسة CSP تسمح بـ unsafe-inline",
                    description="CSP تتضمن 'unsafe-inline' مما يُضعِف الحماية من XSS.",
                    recommendation="احذف 'unsafe-inline' واستخدم nonces أو hashes بدلاً منه.",
                    attack_scenario="مع unsafe-inline يستطيع المهاجم تشغيل سكريبت JavaScript مُضمَّن مباشرة في الصفحة دون الحاجة لملف خارجي، مما يُبطِل الغرض الرئيسي من CSP.",
                    cwe_id="CWE-693",
                    evidence=csp[:200],
                ))
            if "unsafe-eval" in csp:
                result.findings.append(Finding(
                    severity="medium", category="headers",
                    title="CSP Allows unsafe-eval",
                    title_ar="سياسة CSP تسمح بـ unsafe-eval",
                    description="CSP تتضمن 'unsafe-eval' مما يسمح بتنفيذ سلاسل كنصوص برمجية.",
                    recommendation="احذف 'unsafe-eval' من سياسة CSP.",
                    attack_scenario="يستطيع المهاجم استخدام eval() أو setTimeout/setInterval مع سلاسل نصية لتنفيذ كود ضار حتى مع وجود CSP، خاصة في تطبيقات Angular/React القديمة.",
                    cwe_id="CWE-693",
                    evidence=csp[:200],
                ))

    # ── 6. Content Analysis ────────────────────────────────────
    if progress_cb: await progress_cb(70, "Scanning page content...")
    if response and response.status_code == 200:
        try:
            content = response.text[:80_000]
            cl      = content.lower()

            for pattern, severity, title, title_ar, attack_scenario in SENSITIVE_CONTENT_PATTERNS:
                m = re.search(pattern, cl, re.IGNORECASE)
                if m:
                    start = max(0, m.start() - 20)
                    ev    = content[start:start+80].replace("\n", " ").strip()
                    result.findings.append(Finding(
                        severity=severity, category="content",
                        title=title, title_ar=title_ar,
                        description=f"تم اكتشاف نمط حساس في مصدر الصفحة: «{title_ar}»",
                        recommendation="احذف البيانات الحساسة من HTML/JavaScript الظاهر للعموم.",
                        attack_scenario=attack_scenario,
                        evidence=ev[:200],
                    ))

            if "https://" in final_url and re.search(r'src=["\']http://', content, re.IGNORECASE):
                result.findings.append(Finding(
                    severity="medium", category="ssl",
                    title="Mixed Content Detected",
                    title_ar="محتوى مختلط (HTTP داخل HTTPS)",
                    description="الصفحة المشفّرة تحمّل موارد عبر HTTP.",
                    recommendation="حدّث روابط الموارد لتستخدم HTTPS.",
                    attack_scenario="المورد المحمَّل عبر HTTP يمكن اعتراضه وتبديله بمحتوى ضار (Man-in-the-Middle) حتى لو كانت الصفحة الرئيسية مشفّرة.",
                    cwe_id="CWE-319",
                ))
        except Exception:
            pass

    # ── 7. Sensitive Paths ─────────────────────────────────────
    if progress_cb: await progress_cb(85, "Checking sensitive paths...")
    found_paths: list[str] = []
    try:
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        async with httpx.AsyncClient(
            timeout=_PATH_TIMEOUT, follow_redirects=False, verify=False,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SaqrScanner/1.0)"},
        ) as client:
            async def _probe(path: str) -> Optional[str]:
                try:
                    r = await client.get(base_url + path)
                    if r.status_code == 200 and len(r.content) > 50:
                        return path
                except Exception:
                    pass
                return None
            probe_results = await asyncio.gather(*[_probe(p) for p in SUSPICIOUS_PATHS], return_exceptions=True)
            found_paths   = [p for p in probe_results if isinstance(p, str)]
    except Exception:
        pass

    if found_paths:
        is_critical = any(p in found_paths for p in ["/.env", "/.git/HEAD"])
        result.findings.append(Finding(
            severity="critical" if is_critical else "high",
            category="config",
            title="Sensitive Files Publicly Accessible",
            title_ar="ملفات حساسة متاحة للعموم",
            description=f"المسارات التالية أعادت HTTP 200: {', '.join(found_paths)}",
            recommendation="أغلق الوصول لهذه الملفات عبر إعدادات خادم الويب أو .htaccess.",
            attack_scenario=(
                "ملف .env يحتوي عادة على كلمات مرور قاعدة البيانات ومفاتيح API — المهاجم يحصل عليها بطلب واحد. "
                "ملف .git/HEAD يتيح تحميل كامل كود المصدر بأمر git clone، كاشفاً كل منطق التطبيق والأسرار المخزّنة."
                if is_critical else
                "الوصول لـ wp-admin أو phpmyadmin يعرّض لوحات الإدارة لهجمات Brute Force على كلمات المرور."
            ),
            cwe_id="CWE-548",
            evidence=", ".join(found_paths),
        ))

    # ── 8. Positive Info ──────────────────────────────────────
    if response and url.startswith("https://"):
        result.findings.append(Finding(
            severity="info", category="ssl",
            title="HTTPS Enabled",
            title_ar="HTTPS مُفعَّل",
            description="الموقع يُقدَّم عبر HTTPS.",
            recommendation="تأكد من تطبيق HTTPS على جميع الصفحات والنطاقات الفرعية.",
        ))
    if response and response.status_code < 400:
        result.findings.append(Finding(
            severity="info", category="network",
            title="Site Reachable",
            title_ar="الموقع يعمل ويرد على الطلبات",
            description=f"الموقع استجاب بـ HTTP {response.status_code} من IP {ip_address}.",
            recommendation="",
        ))

    if progress_cb: await progress_cb(95, "Calculating risk score...")
    result.compute_risk()
    return result


def _check_ssl(hostname: str, result: ScanResult) -> None:
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
            s.settimeout(_SSL_TIMEOUT)
            s.connect((hostname, 443))
            cert = s.getpeercert()

        expire_str = cert.get("notAfter", "")
        if expire_str:
            expire_dt = datetime.strptime(expire_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
            days_left = (expire_dt - datetime.now(timezone.utc)).days
            if days_left <= 0:
                result.findings.append(Finding(
                    severity="critical", category="ssl",
                    title="SSL Certificate Expired",
                    title_ar="شهادة SSL منتهية الصلاحية",
                    description=f"شهادة SSL انتهت منذ {abs(days_left)} يوم.",
                    recommendation="جدّد الشهادة فوراً.",
                    attack_scenario="الشهادة المنتهية تعني أن المتصفح سيُظهِر تحذيراً للمستخدم؛ بعض المتصفحات ترفض الاتصال كلياً. المهاجم يستغل هذه الحالة لتقديم شهادة مزيّفة خاصة به (MITM) دون أن يُثار الشك.",
                    cwe_id="CWE-298",
                    evidence=f"Expired: {expire_str}",
                ))
            elif days_left <= 14:
                result.findings.append(Finding(
                    severity="high", category="ssl",
                    title="SSL Certificate Expiring Soon",
                    title_ar="شهادة SSL على وشك الانتهاء",
                    description=f"الشهادة تنتهي خلال {days_left} يوم.",
                    recommendation="جدّد الشهادة قبل انتهائها.",
                    attack_scenario=f"خلال {days_left} يوم ستنتهي الشهادة وسيرى المستخدمون تحذيرات أمنية مما قد يدفعهم لقبول شهادات غير موثوقة — فرصة للمهاجم.",
                    cwe_id="CWE-298",
                    evidence=f"Expires in: {days_left} days",
                ))
            elif days_left <= 30:
                result.findings.append(Finding(
                    severity="medium", category="ssl",
                    title="SSL Certificate Expires in 30 Days",
                    title_ar="شهادة SSL تنتهي خلال 30 يوم",
                    description=f"الشهادة تنتهي خلال {days_left} يوم.",
                    recommendation="خطّط لتجديد الشهادة قريباً.",
                    evidence=f"Expires in: {days_left} days",
                ))

    except ssl.SSLCertVerificationError as e:
        result.findings.append(Finding(
            severity="critical", category="ssl",
            title="Invalid SSL Certificate",
            title_ar="شهادة SSL غير صالحة",
            description=f"فشل التحقق من شهادة SSL: {str(e)[:200]}",
            recommendation="احصل على شهادة صالحة من CA موثوق (مثل Let's Encrypt).",
            attack_scenario="الشهادة غير الصالحة تعني أنه لا يمكن التحقق من هوية الخادم — المهاجم يضع خادماً وسيطاً بشهادة مزيّفة لاعتراض الاتصالات (MITM) دون أن يشك المستخدم.",
            cwe_id="CWE-295",
        ))
    except ssl.SSLError as e:
        result.findings.append(Finding(
            severity="high", category="ssl",
            title="SSL Error",
            title_ar="خطأ في SSL",
            description=f"خطأ في اتصال SSL: {str(e)[:200]}",
            recommendation="راجع إعدادات SSL/TLS وتأكد من دعم بروتوكولات حديثة (TLS 1.2+).",
            attack_scenario="بروتوكولات SSL/TLS قديمة (SSLv3، TLS 1.0) تحتوي ثغرات معروفة كـ POODLE وBEAST تسمح باختراق التشفير واستخراج البيانات.",
            cwe_id="CWE-326",
        ))
    except Exception:
        pass
