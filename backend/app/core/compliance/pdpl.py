"""
PDPL — نظام حماية البيانات الشخصية
المملكة العربية السعودية — 1443هـ / 2021م
"""
from app.core.compliance.base import ComplianceItem, FrameworkReport, analyze_requirements

PDPL_REQUIREMENTS = [
    # ── المادة 18: الضوابط الأمنية ────────────────────────────────
    ComplianceItem(
        id="PDPL-18-1",
        domain="Technical Security",
        domain_ar="الضوابط الأمنية التقنية (م. 18)",
        title_ar="الضوابط الأمنية التقنية لحماية البيانات",
        description_ar="اتخاذ الإجراءات التقنية اللازمة لحماية البيانات الشخصية من الوصول غير المصرح به",
        categories=["ssl", "headers"],
        scan_types=["url", "domain"],
        priority="critical",
    ),
    ComplianceItem(
        id="PDPL-18-2",
        domain="Technical Security",
        domain_ar="الضوابط الأمنية التقنية (م. 18)",
        title_ar="تشفير البيانات الشخصية أثناء النقل",
        description_ar="ضمان تشفير البيانات الشخصية أثناء نقلها باستخدام بروتوكولات آمنة",
        categories=["ssl", "secrets"],
        scan_types=["url", "domain", "file"],
        priority="critical",
    ),
    ComplianceItem(
        id="PDPL-18-3",
        domain="Technical Security",
        domain_ar="الضوابط الأمنية التقنية (م. 18)",
        title_ar="ضبط الوصول لأنظمة معالجة البيانات",
        description_ar="تقييد الوصول لأنظمة معالجة البيانات الشخصية وفق مبدأ الحد الأدنى من الصلاحيات",
        categories=["cors", "auth"],
        scan_types=["url", "api"],
        priority="high",
    ),

    # ── المادة 23: نقل البيانات عبر الحدود ───────────────────────
    ComplianceItem(
        id="PDPL-23-1",
        domain="Cross-border Transfer",
        domain_ar="نقل البيانات عبر الحدود (م. 23)",
        title_ar="أمان نقل البيانات عبر القنوات المشفرة",
        description_ar="استخدام قنوات اتصال مشفرة وآمنة عند نقل البيانات الشخصية",
        categories=["ssl"],
        scan_types=["url", "domain"],
        priority="high",
    ),

    # ── المادة 9: مبدأ الحد الأدنى من البيانات ────────────────────
    ComplianceItem(
        id="PDPL-9-1",
        domain="Data Minimization",
        domain_ar="تقليل البيانات المُجمَّعة (م. 9)",
        title_ar="عدم كشف بيانات شخصية غير ضرورية",
        description_ar="التأكد من عدم كشف التطبيق لبيانات شخصية زائدة أو معلومات حساسة في ردوده",
        categories=["content", "config"],
        scan_types=["url", "api"],
        priority="medium",
    ),

    # ── المادة 24: الإبلاغ عن الاختراقات ─────────────────────────
    ComplianceItem(
        id="PDPL-24-1",
        domain="Breach Readiness",
        domain_ar="الجاهزية للإبلاغ عن الاختراقات (م. 24)",
        title_ar="منع تسريب بيانات اعتماد أو مفاتيح API",
        description_ar="التأكد من عدم تخزين بيانات الاعتماد والمفاتيح في الكود لتجنب الاختراقات",
        categories=["secrets"],
        scan_types=["file", "github", "url"],
        priority="critical",
    ),
]


def analyze_pdpl(findings: list[dict], scan_type: str) -> FrameworkReport:
    report = analyze_requirements(PDPL_REQUIREMENTS, findings, scan_type)
    report.framework = "pdpl"
    report.name_ar = "نظام حماية البيانات الشخصية (PDPL)"
    return report
