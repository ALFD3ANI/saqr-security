"""
NCA ECC — الضوابط الأساسية للأمن السيبراني
الهيئة الوطنية للأمن السيبراني — إصدار 2018
"""
from app.core.compliance.base import ComplianceItem, FrameworkReport, analyze_requirements

NCA_ECC_REQUIREMENTS = [
    # ── ECC-2-12: Cryptography ──────────────────────────────────────
    ComplianceItem(
        id="ECC-2-12-1",
        domain="Cryptography",
        domain_ar="ضوابط التشفير",
        title_ar="إدارة شهادات SSL/TLS",
        description_ar="يجب أن تكون شهادات SSL/TLS صالحة وغير منتهية الصلاحية وصادرة من جهة موثوقة",
        categories=["ssl"],
        scan_types=["url", "domain"],
        priority="critical",
    ),
    ComplianceItem(
        id="ECC-2-12-2",
        domain="Cryptography",
        domain_ar="ضوابط التشفير",
        title_ar="بروتوكولات الاتصال الآمن",
        description_ar="استخدام بروتوكولات TLS الحديثة وتجنب البروتوكولات الضعيفة مثل SSLv3 وTLS 1.0",
        categories=["ssl", "network"],
        scan_types=["url", "domain"],
        priority="high",
    ),

    # ── ECC-2-7: Web Application Security ──────────────────────────
    ComplianceItem(
        id="ECC-2-7-1",
        domain="Web Application Security",
        domain_ar="أمن تطبيقات الويب",
        title_ar="رؤوس HTTP الأمنية",
        description_ar="تطبيق رؤوس HTTP الأمنية: Strict-Transport-Security وX-Frame-Options وX-Content-Type-Options",
        categories=["headers"],
        scan_types=["url", "api"],
        priority="high",
    ),
    ComplianceItem(
        id="ECC-2-7-2",
        domain="Web Application Security",
        domain_ar="أمن تطبيقات الويب",
        title_ar="سياسة أمان المحتوى (CSP)",
        description_ar="تطبيق رأس Content-Security-Policy لمنع هجمات XSS وحقن المحتوى",
        categories=["headers"],
        scan_types=["url"],
        priority="high",
    ),
    ComplianceItem(
        id="ECC-2-7-3",
        domain="Web Application Security",
        domain_ar="أمن تطبيقات الويب",
        title_ar="الحماية من محتوى مختلط وتسريب بيانات",
        description_ar="منع تحميل موارد HTTP على صفحات HTTPS وعدم كشف معلومات حساسة في المحتوى",
        categories=["content", "config"],
        scan_types=["url"],
        priority="medium",
    ),

    # ── ECC-2-6: Email Security ─────────────────────────────────────
    ComplianceItem(
        id="ECC-2-6-1",
        domain="Email Security",
        domain_ar="أمن البريد الإلكتروني",
        title_ar="مصادقة البريد الإلكتروني (SPF/DKIM/DMARC)",
        description_ar="تطبيق سجلات SPF وDKIM وDMARC للحماية من انتحال هوية النطاق",
        categories=["email"],
        scan_types=["domain"],
        priority="critical",
    ),

    # ── ECC-2-5: Network Security ────────────────────────────────────
    ComplianceItem(
        id="ECC-2-5-1",
        domain="Network Security",
        domain_ar="أمن الشبكات",
        title_ar="إدارة المنافذ المفتوحة",
        description_ar="إغلاق المنافذ غير الضرورية وتقييد الوصول للخدمات الحساسة",
        categories=["network"],
        scan_types=["domain"],
        priority="critical",
    ),
    ComplianceItem(
        id="ECC-2-5-2",
        domain="Network Security",
        domain_ar="أمن الشبكات",
        title_ar="إعدادات DNS الأمنية",
        description_ar="تطبيق DNSSEC وإدارة سجلات DNS بشكل آمن",
        categories=["dns"],
        scan_types=["domain"],
        priority="medium",
    ),

    # ── ECC-2-4: Access Management ──────────────────────────────────
    ComplianceItem(
        id="ECC-2-4-1",
        domain="Access Management",
        domain_ar="إدارة الهوية والوصول",
        title_ar="ضوابط المصادقة والتحكم في الوصول",
        description_ar="منع الوصول غير المصرح به للموارد والـ APIs الحساسة",
        categories=["auth", "cors"],
        scan_types=["url", "api"],
        priority="critical",
    ),

    # ── ECC-2-9: Application Security ───────────────────────────────
    ComplianceItem(
        id="ECC-2-9-1",
        domain="Application Security",
        domain_ar="أمن التطبيقات",
        title_ar="أمان واجهات برمجة التطبيقات (API)",
        description_ar="تقييد CORS وحماية نقاط API من الوصول غير المصرح والاستغلال",
        categories=["cors", "config"],
        scan_types=["api"],
        priority="high",
    ),

    # ── ECC-2-10: Vulnerability Management ──────────────────────────
    ComplianceItem(
        id="ECC-2-10-1",
        domain="Vulnerability Management",
        domain_ar="إدارة الثغرات الأمنية",
        title_ar="اكتشاف الثغرات في الكود والتبعيات",
        description_ar="فحص الكود المصدري والتبعيات بحثاً عن ثغرات أمنية معروفة",
        categories=["code", "deps"],
        scan_types=["file", "github"],
        priority="high",
    ),

    # ── ECC-2-3: Data Protection ─────────────────────────────────────
    ComplianceItem(
        id="ECC-2-3-1",
        domain="Data Protection",
        domain_ar="حماية المعلومات",
        title_ar="منع كشف المعلومات الحساسة والأسرار",
        description_ar="التأكد من عدم تخزين بيانات اعتماد أو مفاتيح سرية في الكود أو المستودعات",
        categories=["secrets"],
        scan_types=["file", "github", "url"],
        priority="critical",
    ),
]


def analyze_nca_ecc(findings: list[dict], scan_type: str) -> FrameworkReport:
    report = analyze_requirements(NCA_ECC_REQUIREMENTS, findings, scan_type)
    report.framework = "nca_ecc"
    report.name_ar = "الضوابط الأساسية للأمن السيبراني (NCA ECC)"
    return report
