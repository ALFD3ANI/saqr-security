"""
File Scanner — فحص الملفات البرمجية بحثاً عن ثغرات أمنية
يدعم: Python, JavaScript, TypeScript, PHP, Java, HTML, CSS, JSON, YAML, .env
"""
import re
from pathlib import Path
from .base import Finding, ScanResult

# ── أنماط الأسرار ──────────────────────────────────────────────

SECRET_PATTERNS = [
    (r'(?i)password\s*[=:]\s*["\'][^"\']{4,}["\']',          "critical", "Hardcoded Password",         "كلمة مرور مُضمَّنة في الكود"),
    (r'(?i)(?:api[_-]?key|apikey)\s*[=:]\s*["\'][a-z0-9\-_]{16,}["\']', "critical", "Hardcoded API Key", "مفتاح API مُضمَّن"),
    (r'(?i)(?:secret|token|access_token)\s*[=:]\s*["\'][^"\']{16,}["\']', "critical", "Hardcoded Secret/Token", "سر/رمز مُضمَّن"),
    (r'(?i)(?:aws_access_key_id|aws_secret)\s*[=:]\s*["\'][^"\']{16,}["\']', "critical", "AWS Credentials Hardcoded", "بيانات AWS مُضمَّنة"),
    (r'AKIA[0-9A-Z]{16}',                                     "critical", "AWS Access Key ID Pattern", "نمط AWS Access Key"),
    (r'(?i)private[_-]?key\s*[=:]\s*["\']-----BEGIN',        "critical", "Private Key Embedded",      "مفتاح خاص مُضمَّن"),
    (r'(?i)(?:db_pass|database_password|db_password)\s*[=:]\s*["\'][^"\']{3,}["\']', "high", "Database Password Hardcoded", "كلمة مرور قاعدة بيانات مُضمَّنة"),
    (r'(?i)(?:smtp_pass|mail_password)\s*[=:]\s*["\'][^"\']{3,}["\']', "high", "Email Credentials Hardcoded", "بيانات البريد مُضمَّنة"),
    (r'ghp_[a-zA-Z0-9]{36}',                                  "critical", "GitHub Personal Access Token", "GitHub PAT مُضمَّن"),
    (r'sk-[a-zA-Z0-9]{48}',                                   "critical", "OpenAI API Key",             "مفتاح OpenAI مُضمَّن"),
    (r'sk_live_[a-zA-Z0-9]{24,}',                             "critical", "Stripe Live Key",           "مفتاح Stripe حي مُضمَّن"),
]

# ── أنماط الثغرات الأمنية حسب اللغة ──────────────────────────

VULN_PATTERNS: dict[str, list] = {
    "python": [
        (r'\beval\s*\(',                    "high",   "Use of eval()",            "استخدام eval()"),
        (r'\bexec\s*\(',                    "high",   "Use of exec()",            "استخدام exec()"),
        (r'\bpickle\.loads?\b',             "high",   "Insecure Pickle Usage",    "استخدام Pickle غير آمن"),
        (r'\bos\.system\s*\(',             "high",   "Command Injection Risk",   "خطر حقن أوامر OS"),
        (r'\bsubprocess\..*shell\s*=\s*True', "high", "Shell=True Subprocess",   "subprocess بـ shell=True"),
        (r'(?i)md5|sha1\s*\(',            "medium", "Weak Hashing Algorithm",   "خوارزمية تجزئة ضعيفة"),
        (r'random\.random\s*\(',           "low",    "Weak Random for Security", "Random ضعيف للأمان"),
        (r'DEBUG\s*=\s*True',              "medium", "Debug Mode Enabled",       "وضع Debug مُفعَّل"),
        (r'ALLOWED_HOSTS\s*=\s*\[\s*["\'\*]["\']', "medium", "Wildcard ALLOWED_HOSTS", "ALLOWED_HOSTS بدل"),
    ],
    "javascript": [
        (r'\beval\s*\(',                   "high",   "Use of eval()",            "استخدام eval()"),
        (r'document\.write\s*\(',         "medium", "document.write() Usage",  "استخدام document.write()"),
        (r'innerHTML\s*=',                "medium", "innerHTML Assignment",     "تعيين innerHTML مباشر"),
        (r'dangerouslySetInnerHTML',       "medium", "dangerouslySetInnerHTML",  "dangerouslySetInnerHTML"),
        (r'(?:localStorage|sessionStorage)\.setItem\s*\(.*(?:token|password|secret)', "high", "Sensitive Data in Storage", "بيانات حساسة في localStorage"),
        (r'new\s+Function\s*\(',          "high",   "Dynamic Function Creation", "إنشاء دالة ديناميكي"),
        (r'\.on\s*\(\s*["\']message["\']', "low",   "postMessage Listener",    "مستمع postMessage بدون التحقق"),
    ],
    "php": [
        (r'\beval\s*\(',                  "critical", "eval() in PHP",           "eval() في PHP"),
        (r'\bexec\s*\(',                  "high",   "exec() Shell Execution",   "تنفيذ exec()"),
        (r'\bsystem\s*\(',               "high",   "system() Shell Execution", "تنفيذ system()"),
        (r'\$_GET|\$_POST|\$_REQUEST',   "medium", "Direct Superglobal Usage", "استخدام مباشر لـ Superglobal"),
        (r'mysql_query\s*\(',            "high",   "Deprecated mysql_ Function","استخدام mysql_ قديم"),
        (r'md5\s*\(',                    "medium", "MD5 Hashing in PHP",       "تجزئة MD5 في PHP"),
        (r'echo\s+\$_(?:GET|POST|REQUEST)', "critical", "XSS via Reflected Input", "XSS عبر إدخال منعكس"),
        (r'include\s*\(\s*\$',           "critical", "Dynamic File Inclusion",  "تضمين ملف ديناميكي"),
    ],
    "java": [
        (r'\.exec\s*\(',                  "high",   "Runtime.exec() Call",      "استدعاء Runtime.exec()"),
        (r'MessageDigest.*MD5|MessageDigest.*SHA-?1', "medium", "Weak Hash Algorithm", "خوارزمية تجزئة ضعيفة"),
        (r'new\s+Random\s*\(',           "medium", "java.util.Random Usage",   "استخدام java.util.Random"),
        (r'printStackTrace\s*\(',        "low",    "Stack Trace Exposure",     "كشف Stack Trace"),
        (r'catch\s*\(\s*Exception\s+\w+\s*\)\s*\{\s*\}', "medium", "Empty Catch Block", "كتلة catch فارغة"),
    ],
    "generic": [
        (r'(?i)TODO:\s*(?:remove|fix|security|hack)',  "low",    "Security TODO Comment",   "تعليق أمني TODO"),
        (r'(?i)FIXME:\s*(?:security|vuln|injection)', "low",    "Security FIXME Comment",  "تعليق FIXME أمني"),
        (r'(?i)//\s*(?:password|secret)\s*[:=]',     "medium", "Password in Comment",     "كلمة مرور في تعليق"),
        (r'0\.0\.0\.0',                               "low",    "Binding to All Interfaces","ارتباط بكل واجهات الشبكة"),
    ],
}

# ── رسم خرائط امتدادات الملفات ────────────────────────────────

EXT_TO_LANG = {
    ".py": "python", ".pyw": "python",
    ".js": "javascript", ".ts": "javascript", ".jsx": "javascript", ".tsx": "javascript", ".mjs": "javascript",
    ".php": "php",
    ".java": "java",
    ".html": "generic", ".htm": "generic",
    ".env": "generic", ".yml": "generic", ".yaml": "generic",
    ".json": "generic",
    ".sh": "generic", ".bash": "generic",
    ".rb": "generic",  # Ruby
    ".go": "generic",
}

SENSITIVE_FILES = {
    ".env": "critical",
    ".pem": "critical",
    ".key": "critical",
    ".pfx": "critical",
    ".p12": "critical",
    "id_rsa": "critical",
    "id_dsa": "critical",
    ".htpasswd": "high",
    "shadow": "critical",
    "passwd": "high",
    "wp-config.php": "high",
    "config.php": "medium",
    "settings.py": "medium",
    "database.yml": "medium",
}


async def scan_file(filename: str, content: str, progress_cb=None) -> ScanResult:
    result = ScanResult()
    ext = Path(filename).suffix.lower()
    name_lower = Path(filename).name.lower()

    if progress_cb: await progress_cb(10, "Detecting file type...")

    # ── الملفات الحساسة بالاسم ────────────────────────────────
    for sensitive_name, severity in SENSITIVE_FILES.items():
        if sensitive_name in name_lower:
            result.findings.append(Finding(
                severity=severity,
                category="config",
                title=f"Sensitive File: {filename}",
                title_ar=f"ملف حساس: {filename}",
                description=f"The file '{filename}' typically contains sensitive configuration or credentials.",
                recommendation="Do not commit this file to version control. Add it to .gitignore.",
                cwe_id="CWE-312",
            ))

    lines = content.split("\n")
    total_lines = len(lines)

    if progress_cb: await progress_cb(20, "Scanning for secrets...")

    # ── فحص الأسرار ──────────────────────────────────────────
    found_secrets: set[str] = set()
    for pattern, severity, title, title_ar in SECRET_PATTERNS:
        for lineno, line in enumerate(lines, 1):
            match = re.search(pattern, line)
            if match and title not in found_secrets:
                found_secrets.add(title)
                evidence = line.strip()[:120]
                # Redact actual secret value for safety
                evidence = re.sub(r'(["\'])([^"\']{8,})(["\'])', r'\1[REDACTED]\3', evidence)
                result.findings.append(Finding(
                    severity=severity,
                    category="secrets",
                    title=title,
                    title_ar=title_ar,
                    description=f"A potential secret was found at line {lineno}.",
                    recommendation="Move secrets to environment variables or a secrets manager (e.g., HashiCorp Vault, AWS Secrets Manager).",
                    cwe_id="CWE-312",
                    evidence=f"Line {lineno}: {evidence}",
                ))
                break  # one finding per pattern

    if progress_cb: await progress_cb(50, "Scanning for vulnerabilities...")

    # ── فحص الثغرات ──────────────────────────────────────────
    lang = EXT_TO_LANG.get(ext, "generic")
    patterns_to_check = VULN_PATTERNS.get(lang, []) + VULN_PATTERNS["generic"]

    found_vulns: set[str] = set()
    for pattern, severity, title, title_ar in patterns_to_check:
        for lineno, line in enumerate(lines, 1):
            if re.search(pattern, line) and title not in found_vulns:
                found_vulns.add(title)
                result.findings.append(Finding(
                    severity=severity,
                    category="code",
                    title=title,
                    title_ar=title_ar,
                    description=f"Potentially insecure pattern detected at line {lineno}.",
                    recommendation=f"Review and refactor the usage of this pattern.",
                    evidence=f"Line {lineno}: {line.strip()[:150]}",
                ))
                break

    if progress_cb: await progress_cb(80, "Checking file metadata...")

    # ── إحصائيات عامة ────────────────────────────────────────
    result.findings.append(Finding(
        severity="info",
        category="info",
        title="File Analysis Complete",
        title_ar="اكتمل تحليل الملف",
        description=f"Scanned {total_lines} lines ({len(content)} bytes) of {lang} code.",
        recommendation="",
        evidence=f"File: {filename} | Language: {lang} | Lines: {total_lines}",
    ))

    if progress_cb: await progress_cb(95, "Calculating risk...")
    result.compute_risk()
    return result
