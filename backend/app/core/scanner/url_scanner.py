"""
URL/Web Scanner — فحص المواقع الإلكترونية
يفحص: SSL، Security Headers، المحتوى، إعادة التوجيه، معلومات مسرّبة
"""
import asyncio
import ssl
import socket
import re
import json
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urlparse

import httpx

from .base import Finding, ScanResult

# ── Security Headers المطلوبة ──────────────────────────────────

REQUIRED_HEADERS = {
    "strict-transport-security": {
        "title": "Missing HSTS Header",
        "title_ar": "غياب ترويسة HSTS",
        "severity": "high",
        "description": "HTTP Strict Transport Security is not set. Browsers may connect over HTTP.",
        "recommendation": "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
        "cwe_id": "CWE-319",
    },
    "content-security-policy": {
        "title": "Missing Content Security Policy",
        "title_ar": "غياب سياسة أمان المحتوى (CSP)",
        "severity": "high",
        "description": "No CSP header found. The site is vulnerable to XSS and data injection attacks.",
        "recommendation": "Implement a Content-Security-Policy header restricting script sources.",
        "cwe_id": "CWE-1021",
    },
    "x-frame-options": {
        "title": "Missing X-Frame-Options",
        "title_ar": "غياب ترويسة X-Frame-Options",
        "severity": "medium",
        "description": "The site can be embedded in iframes, enabling clickjacking attacks.",
        "recommendation": "Add: X-Frame-Options: DENY  or  X-Frame-Options: SAMEORIGIN",
        "cwe_id": "CWE-1021",
    },
    "x-content-type-options": {
        "title": "Missing X-Content-Type-Options",
        "title_ar": "غياب ترويسة X-Content-Type-Options",
        "severity": "medium",
        "description": "Browser may MIME-sniff responses, potentially executing malicious content.",
        "recommendation": "Add: X-Content-Type-Options: nosniff",
        "cwe_id": "CWE-16",
    },
    "referrer-policy": {
        "title": "Missing Referrer-Policy",
        "title_ar": "غياب ترويسة Referrer-Policy",
        "severity": "low",
        "description": "Referrer information may be leaked to third-party sites.",
        "recommendation": "Add: Referrer-Policy: strict-origin-when-cross-origin",
        "cwe_id": "CWE-200",
    },
    "permissions-policy": {
        "title": "Missing Permissions-Policy",
        "title_ar": "غياب ترويسة Permissions-Policy",
        "severity": "low",
        "description": "Browser features (camera, microphone, geolocation) are not restricted.",
        "recommendation": "Add: Permissions-Policy: geolocation=(), microphone=(), camera=()",
        "cwe_id": "CWE-16",
    },
}

DANGEROUS_HEADERS = {
    "server": {
        "title": "Server Version Disclosure",
        "title_ar": "كشف إصدار الخادم",
        "severity": "medium",
        "description": "The Server header exposes software version information to attackers.",
        "recommendation": "Remove or genericise the Server header in your web server configuration.",
        "cwe_id": "CWE-200",
    },
    "x-powered-by": {
        "title": "Technology Disclosure via X-Powered-By",
        "title_ar": "كشف التقنية عبر X-Powered-By",
        "severity": "low",
        "description": "X-Powered-By reveals the backend technology stack.",
        "recommendation": "Remove the X-Powered-By header.",
        "cwe_id": "CWE-200",
    },
    "x-aspnet-version": {
        "title": "ASP.NET Version Disclosure",
        "title_ar": "كشف إصدار ASP.NET",
        "severity": "medium",
        "description": "The ASP.NET version is exposed, helping attackers target known vulnerabilities.",
        "recommendation": "Disable X-AspNet-Version in Web.config.",
        "cwe_id": "CWE-200",
    },
}

SENSITIVE_CONTENT_PATTERNS = [
    (r"password\s*=\s*['\"][^'\"]{4,}['\"]",  "high",   "Password in Response Body",         "كلمة مرور في محتوى الصفحة"),
    (r"api[_-]?key\s*[=:]\s*['\"][a-z0-9]{16,}['\"]", "high", "API Key Exposed in HTML",     "مفتاح API مكشوف في الكود"),
    (r"access_token\s*[=:]\s*['\"][^'\"]{16,}['\"]",   "high", "Access Token in HTML",        "رمز وصول مكشوف في الكود"),
    (r"<!--.*?(todo|fixme|hack|bug|xxx).*?-->",          "low",  "Developer Comments Found",    "تعليقات المطور في الكود"),
    (r"(?:stack trace|traceback|exception at)",          "high", "Error/Stack Trace Exposed",   "كشف Stack Trace للخادم"),
    (r"(?:phpinfo|<\?php)",                              "critical", "PHP Info Page Detected",  "صفحة phpinfo مكشوفة"),
    (r"(?:mysql_error|pg_last_error|ORA-\d{5})",         "critical", "Database Error Exposed",  "خطأ قاعدة بيانات مكشوف"),
    (r"(?:eval\(|document\.write\(|\.innerHTML\s*=)",    "medium", "Potentially Unsafe JS",     "JavaScript غير آمن محتمل"),
]

SUSPICIOUS_PATHS = [
    "/.git/HEAD", "/.env", "/wp-admin/", "/phpmyadmin/",
    "/admin/", "/.htaccess", "/config.php", "/web.config",
    "/backup/", "/db.sql", "/.DS_Store",
]


async def scan_url(url: str, progress_cb=None) -> ScanResult:
    """الفحص الشامل للـ URL"""
    result = ScanResult()

    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urlparse(url)
    hostname = parsed.hostname or ""

    # ── 1. DNS + Connectivity ──────────────────────────────────
    if progress_cb: await progress_cb(10, "Resolving DNS...")
    try:
        loop = asyncio.get_running_loop()
        ip_address = await asyncio.wait_for(
            loop.run_in_executor(None, socket.gethostbyname, hostname),
            timeout=5.0,
        )
    except (asyncio.TimeoutError, socket.gaierror, OSError):
        result.error = f"DNS resolution failed for {hostname}"
        result.risk_score = 0
        result.risk_level = "unknown"
        return result

    # ── 2. SSL Check ──────────────────────────────────────────
    if progress_cb: await progress_cb(20, "Checking SSL/TLS...")
    if url.startswith("https://"):
        loop = asyncio.get_running_loop()
        await loop.run_in_executor(None, _check_ssl, hostname, result)
    else:
        result.findings.append(Finding(
            severity="critical",
            category="ssl",
            title="No HTTPS",
            title_ar="الموقع لا يستخدم HTTPS",
            description="The site is served over unencrypted HTTP. All data is transmitted in plaintext.",
            recommendation="Enable HTTPS with a valid TLS certificate (Let's Encrypt is free).",
            cwe_id="CWE-319",
        ))

    # ── 3. HTTP Request + Headers ─────────────────────────────
    if progress_cb: await progress_cb(35, "Fetching HTTP headers...")
    response = None
    final_url = url
    redirect_chain = []

    try:
        async with httpx.AsyncClient(
            timeout=15.0,
            follow_redirects=True,
            verify=False,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SaqrScanner/1.0)"},
        ) as client:
            resp = await client.get(url)
            response = resp
            final_url = str(resp.url)
            redirect_chain = [str(h.url) for h in resp.history]
    except httpx.TimeoutException:
        result.findings.append(Finding(
            severity="info",
            category="network",
            title="Slow Response",
            title_ar="استجابة بطيئة",
            description=f"The server at {hostname} did not respond within 15 seconds.",
            recommendation="Investigate server performance and response times.",
        ))
    except Exception as e:
        result.error = f"Connection failed: {str(e)[:200]}"
        result.risk_score = 0
        result.risk_level = "unknown"
        return result

    # ── 4. Redirect Analysis ───────────────────────────────────
    if progress_cb: await progress_cb(45, "Analyzing redirects...")
    if redirect_chain:
        # Check if redirecting to HTTP
        if any("http://" in r for r in redirect_chain):
            result.findings.append(Finding(
                severity="medium",
                category="ssl",
                title="HTTP Redirect in Chain",
                title_ar="إعادة توجيه عبر HTTP غير مشفّر",
                description=f"The redirect chain includes an unencrypted HTTP hop: {redirect_chain}",
                recommendation="Ensure all redirects use HTTPS exclusively.",
                cwe_id="CWE-319",
                evidence=" → ".join(redirect_chain[:5]),
            ))

        if len(redirect_chain) > 3:
            result.findings.append(Finding(
                severity="low",
                category="network",
                title="Excessive Redirects",
                title_ar="سلسلة إعادة توجيه طويلة",
                description=f"The site has {len(redirect_chain)} redirects before reaching the final URL.",
                recommendation="Reduce redirect chains to improve security and performance.",
                evidence=f"{len(redirect_chain)} hops",
            ))

    # ── 5. Security Headers ────────────────────────────────────
    if progress_cb: await progress_cb(55, "Checking security headers...")
    if response:
        headers_lower = {k.lower(): v for k, v in response.headers.items()}

        for header_name, meta in REQUIRED_HEADERS.items():
            if header_name not in headers_lower:
                result.findings.append(Finding(
                    severity=meta["severity"],
                    category="headers",
                    title=meta["title"],
                    title_ar=meta["title_ar"],
                    description=meta["description"],
                    recommendation=meta["recommendation"],
                    cwe_id=meta.get("cwe_id"),
                ))

        for header_name, meta in DANGEROUS_HEADERS.items():
            if header_name in headers_lower:
                value = headers_lower[header_name]
                result.findings.append(Finding(
                    severity=meta["severity"],
                    category="headers",
                    title=meta["title"],
                    title_ar=meta["title_ar"],
                    description=meta["description"],
                    recommendation=meta["recommendation"],
                    cwe_id=meta.get("cwe_id"),
                    evidence=f"{header_name}: {value[:100]}",
                ))

        # Weak CSP check
        csp = headers_lower.get("content-security-policy", "")
        if csp:
            if "unsafe-inline" in csp:
                result.findings.append(Finding(
                    severity="medium", category="headers",
                    title="CSP Allows unsafe-inline",
                    title_ar="سياسة CSP تسمح بـ unsafe-inline",
                    description="The CSP includes 'unsafe-inline' which allows inline scripts and styles, reducing XSS protection.",
                    recommendation="Remove 'unsafe-inline' and use nonces or hashes instead.",
                    cwe_id="CWE-693",
                    evidence=csp[:200],
                ))
            if "unsafe-eval" in csp:
                result.findings.append(Finding(
                    severity="medium", category="headers",
                    title="CSP Allows unsafe-eval",
                    title_ar="سياسة CSP تسمح بـ unsafe-eval",
                    description="The CSP includes 'unsafe-eval' which allows eval(), increasing XSS risk.",
                    recommendation="Remove 'unsafe-eval' from your CSP.",
                    cwe_id="CWE-693",
                    evidence=csp[:200],
                ))
            if "*" in csp:
                result.findings.append(Finding(
                    severity="medium", category="headers",
                    title="CSP Wildcard Source",
                    title_ar="مصدر بدل (*) في سياسة CSP",
                    description="The CSP uses a wildcard (*) which allows loading resources from any domain.",
                    recommendation="Replace wildcards with specific allowed domains.",
                    cwe_id="CWE-693",
                    evidence=csp[:200],
                ))

    # ── 6. Content Analysis ────────────────────────────────────
    if progress_cb: await progress_cb(70, "Scanning page content...")
    if response and response.status_code == 200:
        try:
            content = response.text[:100_000]  # max 100KB
            content_lower = content.lower()

            for pattern, severity, title, title_ar in SENSITIVE_CONTENT_PATTERNS:
                match = re.search(pattern, content_lower, re.IGNORECASE)
                if match:
                    start = max(0, match.start() - 20)
                    evidence = content[start:start + 80].replace("\n", " ").strip()
                    result.findings.append(Finding(
                        severity=severity,
                        category="content",
                        title=title,
                        title_ar=title_ar,
                        description=f"Sensitive pattern detected in the page source: '{title}'",
                        recommendation="Remove sensitive data from public-facing HTML/JavaScript.",
                        evidence=evidence[:200],
                    ))

            # Check for mixed content
            if "https://" in final_url and re.search(r'src=["\']http://', content, re.IGNORECASE):
                result.findings.append(Finding(
                    severity="medium", category="ssl",
                    title="Mixed Content Detected",
                    title_ar="محتوى مختلط (HTTP داخل HTTPS)",
                    description="The HTTPS page loads resources over HTTP, which may be blocked by browsers.",
                    recommendation="Update all resource URLs to use HTTPS.",
                    cwe_id="CWE-319",
                ))
        except Exception:
            pass

    # ── 7. Sensitive Path Check ─────────────────────────────────
    if progress_cb: await progress_cb(85, "Checking sensitive paths...")
    base = f"{parsed.scheme}://{parsed.netloc}"
    found_paths = []

    async def _probe_path(client: httpx.AsyncClient, path: str) -> Optional[str]:
        try:
            r = await client.get(base + path)
            if r.status_code == 200 and len(r.content) > 50:
                return path
        except Exception:
            pass
        return None

    async with httpx.AsyncClient(timeout=5.0, follow_redirects=False, verify=False) as client:
        probe_results = await asyncio.gather(
            *[_probe_path(client, p) for p in SUSPICIOUS_PATHS[:6]]
        )
        found_paths = [p for p in probe_results if p]

    if found_paths:
        result.findings.append(Finding(
            severity="critical" if any(p in found_paths for p in ["/.env", "/.git/HEAD"]) else "high",
            category="config",
            title="Sensitive Files Publicly Accessible",
            title_ar="ملفات حساسة متاحة للعموم",
            description=f"The following sensitive paths returned HTTP 200: {', '.join(found_paths)}",
            recommendation="Restrict access to sensitive files via web server configuration or .htaccess rules.",
            cwe_id="CWE-548",
            evidence=", ".join(found_paths),
        ))

    # ── 8. Positive finding (info) ─────────────────────────────
    if response and url.startswith("https://"):
        result.findings.append(Finding(
            severity="info", category="ssl",
            title="HTTPS Enabled",
            title_ar="HTTPS مُفعَّل",
            description="The site serves content over HTTPS.",
            recommendation="Ensure all pages enforce HTTPS including subdomains.",
        ))

    if response and response.status_code < 400:
        result.findings.append(Finding(
            severity="info", category="network",
            title="Site Reachable",
            title_ar="الموقع يعمل ويرد على الطلبات",
            description=f"The site responded with HTTP {response.status_code} from IP {ip_address}.",
            recommendation="",
        ))

    # ── Compute risk ──────────────────────────────────────────
    if progress_cb: await progress_cb(95, "Calculating risk score...")
    result.compute_risk()
    return result


def _check_ssl(hostname: str, result: ScanResult) -> None:
    try:
        ctx = ssl.create_default_context()
        with ctx.wrap_socket(socket.socket(), server_hostname=hostname) as s:
            s.settimeout(8)
            s.connect((hostname, 443))
            cert = s.getpeercert()

        # Check expiry
        expire_str = cert.get("notAfter", "")
        if expire_str:
            expire_dt = datetime.strptime(expire_str, "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
            days_left = (expire_dt - datetime.now(timezone.utc)).days
            if days_left <= 0:
                result.findings.append(Finding(
                    severity="critical", category="ssl",
                    title="SSL Certificate Expired",
                    title_ar="شهادة SSL منتهية الصلاحية",
                    description=f"The SSL certificate expired {abs(days_left)} days ago.",
                    recommendation="Renew the SSL certificate immediately.",
                    cwe_id="CWE-298",
                    evidence=f"Expired: {expire_str}",
                ))
            elif days_left <= 14:
                result.findings.append(Finding(
                    severity="high", category="ssl",
                    title="SSL Certificate Expiring Soon",
                    title_ar="شهادة SSL على وشك الانتهاء",
                    description=f"The SSL certificate expires in {days_left} days.",
                    recommendation="Renew the SSL certificate before it expires.",
                    cwe_id="CWE-298",
                    evidence=f"Expires in: {days_left} days ({expire_str})",
                ))
            elif days_left <= 30:
                result.findings.append(Finding(
                    severity="medium", category="ssl",
                    title="SSL Certificate Expires in 30 Days",
                    title_ar="شهادة SSL تنتهي خلال 30 يوم",
                    description=f"The SSL certificate expires in {days_left} days. Plan renewal soon.",
                    recommendation="Renew the certificate or set up auto-renewal.",
                    evidence=f"Expires in: {days_left} days",
                ))

    except ssl.SSLCertVerificationError as e:
        result.findings.append(Finding(
            severity="critical", category="ssl",
            title="Invalid SSL Certificate",
            title_ar="شهادة SSL غير صالحة",
            description=f"SSL certificate validation failed: {str(e)[:200]}",
            recommendation="Obtain a valid certificate from a trusted CA (e.g., Let's Encrypt).",
            cwe_id="CWE-295",
        ))
    except ssl.SSLError as e:
        result.findings.append(Finding(
            severity="high", category="ssl",
            title="SSL Error",
            title_ar="خطأ في SSL",
            description=f"An SSL error occurred: {str(e)[:200]}",
            recommendation="Review your SSL/TLS configuration.",
            cwe_id="CWE-326",
        ))
    except Exception:
        pass  # SSL check failed silently — don't block the rest of the scan
