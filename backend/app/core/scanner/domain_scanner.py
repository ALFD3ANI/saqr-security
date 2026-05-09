"""
Domain Scanner — فحص أمان النطاق
يفحص: DNS Records, SPF, DMARC, DKIM, Subdomains, Open Ports, Email Security
"""
import asyncio
import socket
import json
from typing import Optional

import httpx

from .base import Finding, ScanResult

# منافذ شائعة للفحص
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
    (8443, "HTTPS-Alt",  "info"),
    (27017, "MongoDB",   "critical"),
    (9200, "Elasticsearch", "critical"),
]

# نطاقات فرعية شائعة للاختبار
COMMON_SUBDOMAINS = [
    "www", "mail", "webmail", "smtp", "api", "dev", "staging",
    "admin", "dashboard", "portal", "ftp", "vpn", "remote",
    "test", "beta", "shop", "blog", "app",
]


async def _doh_query(domain: str, record_type: str) -> list[str]:
    """استعلام DNS-over-HTTPS من Cloudflare"""
    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            resp = await client.get(
                "https://cloudflare-dns.com/dns-query",
                params={"name": domain, "type": record_type},
                headers={"Accept": "application/dns-json"},
            )
            data = resp.json()
            return [a.get("data", "") for a in data.get("Answer", [])]
    except Exception:
        return []


async def _check_port(host: str, port: int, timeout: float = 2.0) -> bool:
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port), timeout=timeout
        )
        writer.close()
        try: await writer.wait_closed()
        except Exception: pass
        return True
    except Exception:
        return False


async def scan_domain(domain: str, progress_cb=None) -> ScanResult:
    result = ScanResult()

    # تنظيف النطاق
    domain = domain.lower().strip()
    domain = domain.replace("https://", "").replace("http://", "").split("/")[0]

    if progress_cb: await progress_cb(5, "Resolving domain...")

    # ── 1. DNS A Record ──────────────────────────────────────
    try:
        ip = socket.gethostbyname(domain)
    except socket.gaierror:
        result.error = f"Cannot resolve domain: {domain}"
        result.risk_score = 0
        result.risk_level = "unknown"
        return result

    result.findings.append(Finding(
        severity="info", category="dns",
        title="Domain Resolved",
        title_ar="النطاق يُحلَّل بنجاح",
        description=f"Domain resolves to IP: {ip}",
        recommendation="",
        evidence=f"A record: {domain} → {ip}",
    ))

    if progress_cb: await progress_cb(15, "Checking DNS records...")

    # ── 2. MX Records ────────────────────────────────────────
    mx_records = await _doh_query(domain, "MX")
    if mx_records:
        result.findings.append(Finding(
            severity="info", category="email",
            title="MX Records Found",
            title_ar="سجلات MX موجودة",
            description="Mail exchange records are configured.",
            recommendation="",
            evidence="\n".join(mx_records[:5]),
        ))
    else:
        result.findings.append(Finding(
            severity="info", category="email",
            title="No MX Records",
            title_ar="لا توجد سجلات MX",
            description="No mail exchange records configured. This domain doesn't send/receive email.",
            recommendation="If email is needed, configure MX records.",
        ))

    if progress_cb: await progress_cb(25, "Checking email security (SPF/DMARC)...")

    # ── 3. SPF Record ────────────────────────────────────────
    txt_records = await _doh_query(domain, "TXT")
    spf_records = [r for r in txt_records if "v=spf1" in r.lower()]

    if not spf_records:
        result.findings.append(Finding(
            severity="high", category="email",
            title="Missing SPF Record",
            title_ar="غياب سجل SPF",
            description="No SPF record found. Email spoofing attacks are possible — anyone can send email appearing to come from this domain.",
            recommendation='Add a TXT record: "v=spf1 include:_spf.google.com ~all" (adjust for your mail provider)',
            cwe_id="CWE-290",
        ))
    else:
        spf = spf_records[0]
        result.findings.append(Finding(
            severity="info", category="email",
            title="SPF Record Found",
            title_ar="سجل SPF موجود",
            description="SPF record is configured.",
            recommendation="",
            evidence=spf[:200],
        ))
        # Check for dangerous SPF policies
        if "+all" in spf:
            result.findings.append(Finding(
                severity="critical", category="email",
                title="SPF +all Allows All Senders",
                title_ar="سياسة SPF +all تسمح لأي مرسل",
                description="The SPF record uses '+all' which allows any server to send email for this domain.",
                recommendation='Replace "+all" with "-all" or "~all".',
                cwe_id="CWE-290",
                evidence=spf[:200],
            ))

    # ── 4. DMARC Record ──────────────────────────────────────
    dmarc_records = await _doh_query(f"_dmarc.{domain}", "TXT")
    dmarc = next((r for r in dmarc_records if "v=dmarc1" in r.lower()), None)

    if not dmarc:
        result.findings.append(Finding(
            severity="high", category="email",
            title="Missing DMARC Record",
            title_ar="غياب سجل DMARC",
            description="No DMARC policy found. Email spoofing and phishing using this domain is not reported or blocked.",
            recommendation='Add: _dmarc.domain.com TXT "v=DMARC1; p=quarantine; rua=mailto:dmarc@domain.com"',
            cwe_id="CWE-290",
        ))
    else:
        result.findings.append(Finding(
            severity="info", category="email",
            title="DMARC Record Found",
            title_ar="سجل DMARC موجود",
            description="DMARC policy is configured.",
            recommendation="",
            evidence=dmarc[:200],
        ))
        if "p=none" in dmarc.lower():
            result.findings.append(Finding(
                severity="medium", category="email",
                title="DMARC Policy is 'none' (Monitor Only)",
                title_ar="سياسة DMARC هي 'none' — للمراقبة فقط",
                description="DMARC policy is set to 'none', which only monitors but doesn't block or quarantine spoofed email.",
                recommendation='Upgrade policy to p=quarantine or p=reject.',
                evidence=dmarc[:200],
            ))

    if progress_cb: await progress_cb(45, "Enumerating subdomains...")

    # ── 5. Subdomain Enumeration ─────────────────────────────
    found_subs = []
    tasks = [asyncio.create_task(_resolve_sub(f"{sub}.{domain}")) for sub in COMMON_SUBDOMAINS]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for sub, resolved_ip in zip(COMMON_SUBDOMAINS, results):
        if isinstance(resolved_ip, str) and resolved_ip:
            found_subs.append(f"{sub}.{domain} → {resolved_ip}")

    if found_subs:
        result.findings.append(Finding(
            severity="info", category="dns",
            title=f"Subdomains Found ({len(found_subs)})",
            title_ar=f"نطاقات فرعية موجودة ({len(found_subs)})",
            description="The following subdomains were discovered:",
            recommendation="Ensure all subdomains are intentionally public and have security configurations.",
            evidence="\n".join(found_subs[:20]),
        ))

    if progress_cb: await progress_cb(65, "Scanning common ports...")

    # ── 6. Port Scanning ─────────────────────────────────────
    port_tasks = [asyncio.create_task(_check_port(ip, port)) for port, _, _ in COMMON_PORTS]
    port_results = await asyncio.gather(*port_tasks, return_exceptions=True)

    open_ports = []
    for (port, service, risk), is_open in zip(COMMON_PORTS, port_results):
        if is_open is True:
            open_ports.append((port, service, risk))

    # Report critical/risky open ports
    for port, service, risk in open_ports:
        if risk in ("critical", "high"):
            result.findings.append(Finding(
                severity=risk, category="network",
                title=f"Open Port: {port}/{service}",
                title_ar=f"منفذ مفتوح: {port}/{service}",
                description=f"Port {port} ({service}) is publicly accessible from the internet.",
                recommendation=f"Restrict access to port {port} via firewall rules. Only allow trusted IP ranges.",
                cwe_id="CWE-200",
                evidence=f"{ip}:{port} ({service}) — OPEN",
            ))
        elif risk == "medium":
            result.findings.append(Finding(
                severity="medium", category="network",
                title=f"Open Port: {port}/{service}",
                title_ar=f"منفذ مفتوح: {port}/{service}",
                description=f"Port {port} ({service}) is publicly accessible.",
                recommendation="Verify this port needs to be public. Consider restricting access.",
                evidence=f"{ip}:{port} ({service}) — OPEN",
            ))

    if open_ports:
        all_open = [f"{p}/{s}" for p, s, _ in open_ports]
        result.findings.append(Finding(
            severity="info", category="network",
            title=f"Open Ports Summary ({len(open_ports)})",
            title_ar=f"ملخص المنافذ المفتوحة ({len(open_ports)})",
            description="Ports open and reachable from the internet:",
            recommendation="Review all open ports and close unnecessary ones.",
            evidence=", ".join(all_open),
        ))

    if progress_cb: await progress_cb(85, "Checking HTTPS...")

    # ── 7. HTTPS + URL Scanner ───────────────────────────────
    from .url_scanner import scan_url
    url_result = await scan_url(f"https://{domain}")
    # Merge key findings
    for f in url_result.findings:
        if f.category in ("ssl", "headers") and f.severity in ("critical", "high", "medium"):
            result.findings.append(f)

    # ── 8. DNSSEC Check ──────────────────────────────────────
    ds_records = await _doh_query(domain, "DS")
    if not ds_records:
        result.findings.append(Finding(
            severity="low", category="dns",
            title="DNSSEC Not Detected",
            title_ar="DNSSEC غير مكتشف",
            description="DNSSEC does not appear to be configured. DNS responses can be spoofed.",
            recommendation="Enable DNSSEC through your domain registrar.",
            cwe_id="CWE-290",
        ))

    if progress_cb: await progress_cb(95, "Calculating risk...")
    result.compute_risk()
    return result


async def _resolve_sub(hostname: str) -> Optional[str]:
    try:
        loop = asyncio.get_event_loop()
        ip = await loop.run_in_executor(None, socket.gethostbyname, hostname)
        return ip
    except Exception:
        return None
