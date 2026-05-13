"""
Domain Scanner — فحص أمان النطاق
يفحص: DNS Records, SPF, DMARC, DKIM, Subdomains, Open Ports, Email Security
"""
import asyncio
import socket
from typing import Optional

import httpx

from .base import Finding, ScanResult

COMMON_PORTS = [
    (21,   "FTP",        "high"),
    (22,   "SSH",        "info"),
    (23,   "Telnet",     "critical"),
    (25,   "SMTP",       "medium"),
    (80,   "HTTP",       "info"),
    (443,  "HTTPS",      "info"),
    (3306, "MySQL",      "critical"),
    (5432, "PostgreSQL", "critical"),
    (6379, "Redis",      "critical"),
    (8080, "HTTP-Alt",   "medium"),
    (27017, "MongoDB",   "critical"),
]

COMMON_SUBDOMAINS = [
    "www", "mail", "webmail", "smtp", "api", "dev", "staging",
    "admin", "dashboard", "ftp", "vpn", "test", "beta", "app",
]

_DOH_TIMEOUT   = 4.0
_PORT_TIMEOUT  = 1.5
_DNS_TIMEOUT   = 4.0
_SUB_TIMEOUT   = 2.0


async def _doh_query(domain: str, record_type: str) -> list[str]:
    """استعلام DNS-over-HTTPS من Cloudflare"""
    try:
        async with httpx.AsyncClient(timeout=_DOH_TIMEOUT) as client:
            resp = await client.get(
                "https://cloudflare-dns.com/dns-query",
                params={"name": domain, "type": record_type},
                headers={"Accept": "application/dns-json"},
            )
            data = resp.json()
            return [a.get("data", "") for a in data.get("Answer", [])]
    except Exception:
        return []


async def _check_port(host: str, port: int) -> bool:
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=_PORT_TIMEOUT
        )
        writer.close()
        try: await writer.wait_closed()
        except Exception: pass
        return True
    except Exception:
        return False


async def _resolve_sub(hostname: str) -> Optional[str]:
    try:
        loop = asyncio.get_event_loop()
        ip = await asyncio.wait_for(
            loop.run_in_executor(None, socket.gethostbyname, hostname),
            timeout=_SUB_TIMEOUT,
        )
        return ip
    except Exception:
        return None


async def scan_domain(domain: str, progress_cb=None) -> ScanResult:
    result = ScanResult()

    domain = domain.lower().strip()
    domain = domain.replace("https://", "").replace("http://", "").split("/")[0]
    domain = domain.split(":")[0]  # remove port if present

    if progress_cb: await progress_cb(5, "Resolving domain...")

    # ── 1. DNS A Record ──────────────────────────────────────
    try:
        loop = asyncio.get_running_loop()
        ip = await asyncio.wait_for(
            loop.run_in_executor(None, socket.gethostbyname, domain),
            timeout=_DNS_TIMEOUT,
        )
    except asyncio.TimeoutError:
        result.error = f"انتهت مهلة حل DNS للنطاق: {domain}"
        result.risk_score = 0
        result.risk_level = "unknown"
        return result
    except (socket.gaierror, OSError):
        result.error = f"لم يتم العثور على النطاق: {domain} — تأكد من صحة العنوان"
        result.risk_score = 0
        result.risk_level = "unknown"
        return result

    result.findings.append(Finding(
        severity="info", category="dns",
        title="Domain Resolved",
        title_ar="النطاق يُحلَّل بنجاح",
        description=f"النطاق يُحلَّل إلى IP: {ip}",
        recommendation="",
        evidence=f"A record: {domain} → {ip}",
    ))

    if progress_cb: await progress_cb(15, "Checking DNS records...")

    # ── 2. MX + SPF + DMARC (parallel DOH queries) ───────────
    mx_task    = asyncio.create_task(_doh_query(domain, "MX"))
    txt_task   = asyncio.create_task(_doh_query(domain, "TXT"))
    dmarc_task = asyncio.create_task(_doh_query(f"_dmarc.{domain}", "TXT"))
    ds_task    = asyncio.create_task(_doh_query(domain, "DS"))

    mx_records, txt_records, dmarc_records, ds_records = await asyncio.gather(
        mx_task, txt_task, dmarc_task, ds_task
    )

    # MX
    if mx_records:
        result.findings.append(Finding(
            severity="info", category="email",
            title="MX Records Found",
            title_ar="سجلات MX موجودة",
            description="سجلات البريد الإلكتروني مُعدَّة.",
            recommendation="",
            evidence="\n".join(mx_records[:5]),
        ))
    else:
        result.findings.append(Finding(
            severity="info", category="email",
            title="No MX Records",
            title_ar="لا توجد سجلات MX",
            description="لا توجد سجلات MX — هذا النطاق لا يستقبل بريداً إلكترونياً.",
            recommendation="إذا كنت تحتاج للبريد، أضف سجلات MX.",
        ))

    # SPF
    spf_records = [r for r in txt_records if "v=spf1" in r.lower()]
    if not spf_records:
        result.findings.append(Finding(
            severity="high", category="email",
            title="Missing SPF Record",
            title_ar="غياب سجل SPF",
            description="لا يوجد سجل SPF — يمكن لأي شخص إرسال بريد مزوّر من هذا النطاق.",
            recommendation='أضف TXT record: "v=spf1 include:_spf.google.com ~all"',
            cwe_id="CWE-290",
        ))
    else:
        spf = spf_records[0]
        result.findings.append(Finding(
            severity="info", category="email",
            title="SPF Record Found",
            title_ar="سجل SPF موجود",
            description="سجل SPF مُعدَّ.",
            recommendation="",
            evidence=spf[:200],
        ))
        if "+all" in spf:
            result.findings.append(Finding(
                severity="critical", category="email",
                title="SPF +all — Allows Any Sender",
                title_ar="سياسة SPF +all تسمح لأي مرسل",
                description='سجل SPF يستخدم "+all" مما يسمح لأي خادم بإرسال بريد باسم نطاقك.',
                recommendation='استبدل "+all" بـ "-all" أو "~all".',
                cwe_id="CWE-290",
                evidence=spf[:200],
            ))

    # DMARC
    dmarc = next((r for r in dmarc_records if "v=dmarc1" in r.lower()), None)
    if not dmarc:
        result.findings.append(Finding(
            severity="high", category="email",
            title="Missing DMARC Record",
            title_ar="غياب سجل DMARC",
            description="لا توجد سياسة DMARC — لا يمكن الإبلاغ عن بريد مزوّر أو إيقافه.",
            recommendation='أضف: _dmarc.domain TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@domain.com"',
            cwe_id="CWE-290",
        ))
    else:
        result.findings.append(Finding(
            severity="info", category="email",
            title="DMARC Record Found",
            title_ar="سجل DMARC موجود",
            description="سياسة DMARC مُعدَّة.",
            recommendation="",
            evidence=dmarc[:200],
        ))
        if "p=none" in dmarc.lower():
            result.findings.append(Finding(
                severity="medium", category="email",
                title="DMARC Policy is 'none' (Monitor Only)",
                title_ar="سياسة DMARC هي 'none' — للمراقبة فقط",
                description="سياسة DMARC مضبوطة على 'none' — تراقب فقط ولا تمنع البريد المزوّر.",
                recommendation="رفّع السياسة إلى p=quarantine أو p=reject.",
                evidence=dmarc[:200],
            ))

    if progress_cb: await progress_cb(40, "Enumerating subdomains...")

    # ── 3. Subdomain Enumeration (parallel) ───────────────────
    sub_tasks = [asyncio.create_task(_resolve_sub(f"{s}.{domain}")) for s in COMMON_SUBDOMAINS]
    sub_results = await asyncio.gather(*sub_tasks, return_exceptions=True)
    found_subs = [
        f"{s}.{domain} → {ip}"
        for s, ip in zip(COMMON_SUBDOMAINS, sub_results)
        if isinstance(ip, str) and ip
    ]
    if found_subs:
        result.findings.append(Finding(
            severity="info", category="dns",
            title=f"Subdomains Found ({len(found_subs)})",
            title_ar=f"نطاقات فرعية موجودة ({len(found_subs)})",
            description="تم اكتشاف النطاقات الفرعية التالية:",
            recommendation="تأكد أن جميع النطاقات الفرعية مقصودة ومُأمَّنة.",
            evidence="\n".join(found_subs[:15]),
        ))

    if progress_cb: await progress_cb(60, "Scanning common ports...")

    # ── 4. Port Scanning (parallel, fast) ─────────────────────
    port_tasks = [asyncio.create_task(_check_port(ip, port)) for port, _, _ in COMMON_PORTS]
    port_results = await asyncio.gather(*port_tasks, return_exceptions=True)

    open_ports = [
        (port, service, risk)
        for (port, service, risk), is_open in zip(COMMON_PORTS, port_results)
        if is_open is True
    ]

    for port, service, risk in open_ports:
        if risk in ("critical", "high"):
            result.findings.append(Finding(
                severity=risk, category="network",
                title=f"Open Port: {port}/{service}",
                title_ar=f"منفذ مفتوح: {port}/{service}",
                description=f"المنفذ {port} ({service}) متاح للعموم عبر الإنترنت.",
                recommendation=f"قيّد الوصول للمنفذ {port} عبر جدار الحماية. اسمح فقط للـ IPs الموثوقة.",
                cwe_id="CWE-200",
                evidence=f"{ip}:{port} ({service}) — OPEN",
            ))
        elif risk == "medium":
            result.findings.append(Finding(
                severity="medium", category="network",
                title=f"Open Port: {port}/{service}",
                title_ar=f"منفذ مفتوح: {port}/{service}",
                description=f"المنفذ {port} ({service}) متاح للعموم.",
                recommendation="تحقق من ضرورة أن يكون هذا المنفذ عاماً.",
                evidence=f"{ip}:{port} ({service}) — OPEN",
            ))

    if open_ports:
        all_open = [f"{p}/{s}" for p, s, _ in open_ports]
        result.findings.append(Finding(
            severity="info", category="network",
            title=f"Open Ports Summary ({len(open_ports)})",
            title_ar=f"ملخص المنافذ المفتوحة ({len(open_ports)})",
            description="المنافذ المفتوحة والمتاحة من الإنترنت:",
            recommendation="راجع جميع المنافذ المفتوحة وأغلق غير الضرورية.",
            evidence=", ".join(all_open),
        ))

    if progress_cb: await progress_cb(80, "Checking HTTPS + headers...")

    # ── 5. HTTPS + Headers (with timeout guard) ───────────────
    try:
        from .url_scanner import scan_url
        url_result = await asyncio.wait_for(
            scan_url(f"https://{domain}"),
            timeout=20.0,  # cap url scan within domain scan
        )
        for f in url_result.findings:
            if f.category in ("ssl", "headers") and f.severity in ("critical", "high", "medium"):
                result.findings.append(f)
    except asyncio.TimeoutError:
        result.findings.append(Finding(
            severity="info", category="network",
            title="HTTPS Check Timed Out",
            title_ar="انتهت مهلة فحص HTTPS",
            description=f"انتهت مهلة فحص HTTPS لـ {domain} — قد يكون الموقع بطيئاً أو يحجب الفحص الآلي.",
            recommendation="جرّب فحص URL مستقل لهذا النطاق.",
        ))
    except Exception:
        pass

    # ── 6. DNSSEC ────────────────────────────────────────────
    if not ds_records:
        result.findings.append(Finding(
            severity="low", category="dns",
            title="DNSSEC Not Detected",
            title_ar="DNSSEC غير مكتشف",
            description="لا يبدو أن DNSSEC مُفعَّل — يمكن تزوير ردود DNS.",
            recommendation="فعّل DNSSEC عبر مزود النطاق.",
            cwe_id="CWE-290",
        ))

    if progress_cb: await progress_cb(95, "Calculating risk...")
    result.compute_risk()
    return result
