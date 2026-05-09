"""
SAMA CSF — إطار عمل الأمن السيبراني
مؤسسة النقد العربي السعودي (ساما)
"""
from app.core.compliance.base import ComplianceItem, FrameworkReport, analyze_requirements

SAMA_CSF_REQUIREMENTS = [
    # ── OM-7: Encryption ──────────────────────────────────────────
    ComplianceItem(
        id="SAMA-OM-7-1",
        domain="Operations Management",
        domain_ar="إدارة العمليات",
        title_ar="تشفير البيانات والاتصالات",
        description_ar="استخدام بروتوكولات TLS الحديثة وشهادات رقمية صالحة لجميع الاتصالات",
        categories=["ssl"],
        scan_types=["url", "domain"],
        priority="critical",
    ),

    # ── OM-5: Web Security ────────────────────────────────────────
    ComplianceItem(
        id="SAMA-OM-5-1",
        domain="Operations Management",
        domain_ar="إدارة العمليات",
        title_ar="أمان تطبيقات الويب",
        description_ar="تطبيق إجراءات أمنية لحماية تطبيقات الويب من الثغرات الشائعة (OWASP Top 10)",
        categories=["headers", "content"],
        scan_types=["url"],
        priority="high",
    ),

    # ── OM-4: Email Security ──────────────────────────────────────
    ComplianceItem(
        id="SAMA-OM-4-1",
        domain="Operations Management",
        domain_ar="إدارة العمليات",
        title_ar="ضوابط أمان البريد الإلكتروني",
        description_ar="تطبيق SPF وDKIM وDMARC لمنع انتحال هوية الشركة والتصيد الاحتيالي",
        categories=["email"],
        scan_types=["domain"],
        priority="critical",
    ),

    # ── OM-3: Network Security ────────────────────────────────────
    ComplianceItem(
        id="SAMA-OM-3-1",
        domain="Operations Management",
        domain_ar="إدارة العمليات",
        title_ar="ضوابط أمان الشبكة",
        description_ar="إغلاق المنافذ غير الضرورية وتقييد الوصول لخدمات الشبكة",
        categories=["network"],
        scan_types=["domain"],
        priority="critical",
    ),

    # ── OM-6: Code & Dependency Security ─────────────────────────
    ComplianceItem(
        id="SAMA-OM-6-1",
        domain="Operations Management",
        domain_ar="إدارة العمليات",
        title_ar="أمان الكود المصدري",
        description_ar="فحص الكود بحثاً عن ثغرات أمنية (SQL Injection, XSS, Path Traversal)",
        categories=["code"],
        scan_types=["file", "github"],
        priority="high",
    ),
    ComplianceItem(
        id="SAMA-OM-6-2",
        domain="Operations Management",
        domain_ar="إدارة العمليات",
        title_ar="إدارة المكتبات والتبعيات الخارجية",
        description_ar="مراجعة التبعيات وتحديث المكتبات ذات الثغرات المعروفة",
        categories=["deps"],
        scan_types=["github", "file"],
        priority="medium",
    ),

    # ── API Security ──────────────────────────────────────────────
    ComplianceItem(
        id="SAMA-OM-5-2",
        domain="Operations Management",
        domain_ar="إدارة العمليات",
        title_ar="أمان واجهات API",
        description_ar="تأمين نقاط API وتقييد CORS ومنع الوصول غير المصرح به",
        categories=["cors", "auth"],
        scan_types=["api", "url"],
        priority="high",
    ),

    # ── RM-2: Risk Management ─────────────────────────────────────
    ComplianceItem(
        id="SAMA-RM-2-1",
        domain="Risk Management",
        domain_ar="إدارة المخاطر",
        title_ar="إدارة الثغرات ومراجعة الأمان",
        description_ar="إجراء تقييم دوري للثغرات وتتبع نتائج الفحوصات الأمنية",
        categories=["ssl", "headers", "cors", "network"],
        scan_types=["url", "domain", "api"],
        priority="high",
    ),

    # ── CP: Compliance ────────────────────────────────────────────
    ComplianceItem(
        id="SAMA-CP-1",
        domain="Compliance",
        domain_ar="الامتثال التنظيمي",
        title_ar="الامتثال لبروتوكولات الأمان",
        description_ar="الالتزام بمعايير TLS والبروتوكولات الأمنية المعتمدة في الاتصالات الإلكترونية",
        categories=["ssl", "email"],
        scan_types=["url", "domain"],
        priority="medium",
    ),

    # ── Data Protection ───────────────────────────────────────────
    ComplianceItem(
        id="SAMA-OM-8-1",
        domain="Operations Management",
        domain_ar="إدارة العمليات",
        title_ar="حماية بيانات الاعتماد والأسرار",
        description_ar="منع تخزين كلمات المرور والمفاتيح السرية في الكود أو المستودعات",
        categories=["secrets"],
        scan_types=["file", "github", "url"],
        priority="critical",
    ),
]


def analyze_sama_csf(findings: list[dict], scan_type: str) -> FrameworkReport:
    report = analyze_requirements(SAMA_CSF_REQUIREMENTS, findings, scan_type)
    report.framework = "sama_csf"
    report.name_ar = "إطار عمل الأمن السيبراني لساما (SAMA CSF)"
    return report
