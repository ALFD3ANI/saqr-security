"""
API Scanner — فحص أمان REST APIs
يفحص: CORS، Authentication، Rate Limiting، HTTP Methods، Response Leakage
"""
import json
from typing import Optional

import httpx

from .base import Finding, ScanResult

SENSITIVE_RESPONSE_PATTERNS = [
    ("password",      "critical", "Password in API Response",    "كلمة مرور في استجابة API"),
    ("secret",        "critical", "Secret in API Response",      "سر في استجابة API"),
    ("access_token",  "high",     "Token in API Response",       "رمز في استجابة API"),
    ("private_key",   "critical", "Private Key in Response",     "مفتاح خاص في الاستجابة"),
    ("api_key",       "high",     "API Key in Response",         "مفتاح API في الاستجابة"),
    ("stack trace",   "high",     "Stack Trace Leaked",          "كشف Stack Trace"),
    ("traceback",     "high",     "Python Traceback Leaked",     "كشف Traceback Python"),
    ("internal server error", "medium", "Internal Server Error", "خطأ داخلي في الخادم"),
    ("debug",         "medium",   "Debug Info in Response",      "معلومات Debug في الاستجابة"),
    ("exception",     "medium",   "Exception Details Exposed",   "تفاصيل استثناء مكشوفة"),
    ("sql syntax",    "critical", "SQL Error in Response",       "خطأ SQL في الاستجابة"),
    ("mysql_error",   "critical", "MySQL Error in Response",     "خطأ MySQL في الاستجابة"),
]

COMMON_API_PATHS = [
    "/api", "/api/v1", "/api/v2",
    "/swagger", "/swagger-ui", "/swagger.json", "/openapi.json",
    "/docs", "/redoc", "/graphql",
    "/health", "/status", "/version", "/info",
    "/admin", "/admin/api",
    "/metrics", "/actuator", "/actuator/health",
    "/users", "/api/users", "/api/v1/users",
    "/.env", "/config",
]


async def scan_api(base_url: str, auth_header: Optional[str] = None, progress_cb=None) -> ScanResult:
    result = ScanResult()

    if not base_url.startswith("http"):
        base_url = "https://" + base_url

    base_url = base_url.rstrip("/")

    headers = {"User-Agent": "Mozilla/5.0 (compatible; SaqrAPIScanner/1.0)"}
    if auth_header:
        headers["Authorization"] = auth_header

    if progress_cb: await progress_cb(10, "Connecting to API...")

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True, verify=False, headers=headers) as client:

        # ── 1. Base URL Reachability ──────────────────────────
        try:
            base_resp = await client.get(base_url)
        except Exception as e:
            result.error = f"Cannot reach API: {str(e)[:200]}"
            return result

        if progress_cb: await progress_cb(20, "Checking CORS configuration...")

        # ── 2. CORS Check ────────────────────────────────────
        try:
            cors_resp = await client.options(
                base_url,
                headers={**headers, "Origin": "https://evil.com", "Access-Control-Request-Method": "GET"},
            )
            acao = cors_resp.headers.get("access-control-allow-origin", "")
            acac = cors_resp.headers.get("access-control-allow-credentials", "")

            if acao == "*":
                result.findings.append(Finding(
                    severity="medium", category="cors",
                    title="CORS Allows All Origins (*)",
                    title_ar="CORS يسمح لكل النطاقات (*)",
                    description="The API accepts requests from any origin. This may expose data to malicious websites.",
                    recommendation="Restrict CORS to known origins. Never use * with credentials.",
                    cwe_id="CWE-942",
                    evidence=f"Access-Control-Allow-Origin: {acao}",
                ))
            elif acao == "https://evil.com":
                result.findings.append(Finding(
                    severity="high", category="cors",
                    title="CORS Reflects Arbitrary Origin",
                    title_ar="CORS يعكس النطاق الأصل بشكل أعمى",
                    description="The API reflects any Origin header, allowing cross-origin requests from arbitrary domains.",
                    recommendation="Validate the Origin against a whitelist before reflecting it.",
                    cwe_id="CWE-942",
                    evidence=f"Sent Origin: evil.com → Got: {acao}",
                ))

            if acao and "true" in acac.lower() and acao in ("*",):
                result.findings.append(Finding(
                    severity="critical", category="cors",
                    title="CORS: Credentials + Wildcard Origin",
                    title_ar="CORS: بيانات اعتماد مع نطاق بدل",
                    description="The API allows credentials with a wildcard origin, enabling CSRF attacks.",
                    recommendation="Never combine Access-Control-Allow-Credentials: true with Access-Control-Allow-Origin: *",
                    cwe_id="CWE-942",
                ))
        except Exception:
            pass

        if progress_cb: await progress_cb(35, "Testing authentication...")

        # ── 3. Unauthenticated Access to Sensitive Paths ─────
        found_open = []
        for path in COMMON_API_PATHS[:12]:
            try:
                r = await client.get(base_url + path, headers={
                    "User-Agent": headers["User-Agent"]
                    # No auth header intentionally
                })
                if r.status_code == 200 and len(r.content) > 20:
                    content_type = r.headers.get("content-type", "")
                    if "json" in content_type or "html" in content_type:
                        found_open.append((path, r.status_code))
            except Exception:
                pass

        swagger_paths = [p for p, _ in found_open if "swagger" in p or "openapi" in p or "docs" in p]
        if swagger_paths:
            result.findings.append(Finding(
                severity="medium", category="auth",
                title="API Documentation Publicly Accessible",
                title_ar="وثائق API متاحة للعموم",
                description=f"API documentation is accessible without authentication: {', '.join(swagger_paths)}",
                recommendation="Restrict API docs to authenticated users or internal networks in production.",
                cwe_id="CWE-200",
                evidence=", ".join(swagger_paths),
            ))

        admin_open = [p for p, _ in found_open if "admin" in p]
        if admin_open:
            result.findings.append(Finding(
                severity="critical", category="auth",
                title="Admin Endpoint Publicly Accessible",
                title_ar="نقطة نهاية الأدمن متاحة دون مصادقة",
                description=f"Admin API endpoint is accessible without authentication: {', '.join(admin_open)}",
                recommendation="Require strong authentication and authorization for all admin endpoints.",
                cwe_id="CWE-306",
                evidence=", ".join(admin_open),
            ))

        if progress_cb: await progress_cb(55, "Testing HTTP methods...")

        # ── 4. HTTP Methods ──────────────────────────────────
        try:
            trace_resp = await client.request("TRACE", base_url)
            if trace_resp.status_code not in (405, 501, 404):
                result.findings.append(Finding(
                    severity="medium", category="config",
                    title="HTTP TRACE Method Enabled",
                    title_ar="طريقة TRACE مُفعَّلة",
                    description="HTTP TRACE is enabled, which can be used for Cross-Site Tracing (XST) attacks.",
                    recommendation="Disable the TRACE method in your web server configuration.",
                    cwe_id="CWE-16",
                    evidence=f"TRACE returned HTTP {trace_resp.status_code}",
                ))
        except Exception:
            pass

        if progress_cb: await progress_cb(70, "Analyzing response data...")

        # ── 5. Response Content Analysis ─────────────────────
        try:
            resp_text = base_resp.text[:50000].lower()
            for pattern, severity, title, title_ar in SENSITIVE_RESPONSE_PATTERNS:
                if pattern in resp_text:
                    result.findings.append(Finding(
                        severity=severity, category="content",
                        title=title,
                        title_ar=title_ar,
                        description=f"Sensitive pattern '{pattern}' found in API response.",
                        recommendation="Remove sensitive data from API responses. Implement proper error handling.",
                        cwe_id="CWE-200",
                    ))
        except Exception:
            pass

        if progress_cb: await progress_cb(80, "Checking rate limiting...")

        # ── 6. Rate Limiting ─────────────────────────────────
        try:
            responses = []
            for _ in range(5):
                r = await client.get(base_url)
                responses.append(r.status_code)

            if not any(r.status_code == 429 for r in [base_resp]):
                has_rate_limit_header = any(
                    h in base_resp.headers for h in
                    ["x-ratelimit-limit", "x-rate-limit", "retry-after", "ratelimit-limit"]
                )
                if not has_rate_limit_header:
                    result.findings.append(Finding(
                        severity="medium", category="config",
                        title="No Rate Limiting Detected",
                        title_ar="لا يوجد تحديد معدل الطلبات",
                        description="No rate limiting headers or 429 responses detected. The API may be vulnerable to brute-force and DoS attacks.",
                        recommendation="Implement rate limiting (e.g., 100 req/min per IP). Return 429 with Retry-After header when exceeded.",
                        cwe_id="CWE-770",
                    ))
        except Exception:
            pass

        if progress_cb: await progress_cb(88, "Checking security headers...")

        # ── 7. Security Headers ──────────────────────────────
        resp_headers = {k.lower(): v for k, v in base_resp.headers.items()}
        if "x-content-type-options" not in resp_headers:
            result.findings.append(Finding(
                severity="low", category="headers",
                title="Missing X-Content-Type-Options",
                title_ar="غياب ترويسة X-Content-Type-Options",
                description="API responses do not include X-Content-Type-Options: nosniff.",
                recommendation="Add X-Content-Type-Options: nosniff to all API responses.",
                cwe_id="CWE-16",
            ))

        # ── Info ─────────────────────────────────────────────
        result.findings.append(Finding(
            severity="info", category="info",
            title="API Base Response",
            title_ar="استجابة API الأساسية",
            description=f"API base URL responded with HTTP {base_resp.status_code}.",
            recommendation="",
            evidence=f"URL: {base_url} | Status: {base_resp.status_code} | Content-Type: {base_resp.headers.get('content-type', 'unknown')}",
        ))

    if progress_cb: await progress_cb(95, "Calculating risk...")
    result.compute_risk()
    return result
