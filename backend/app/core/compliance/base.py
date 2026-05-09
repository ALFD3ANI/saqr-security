"""
Compliance Base — هياكل بيانات الامتثال المشتركة
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ComplianceItem:
    id: str
    domain: str
    domain_ar: str
    title_ar: str
    description_ar: str
    categories: list[str]       # scanner categories that map to this requirement
    scan_types:  list[str]      # which scan types cover this requirement
    priority: str = "medium"    # critical | high | medium | low
    # filled during analysis:
    status: str = "not_assessed"  # compliant | non_compliant | partial | not_assessed
    findings: list[str] = field(default_factory=list)


@dataclass
class FrameworkReport:
    framework: str
    name_ar: str
    score: int
    total: int
    compliant: int
    non_compliant: int
    partial: int
    not_assessed: int
    items: list[ComplianceItem]

    def to_dict(self) -> dict:
        return {
            "framework": self.framework,
            "name_ar": self.name_ar,
            "score": self.score,
            "total": self.total,
            "compliant": self.compliant,
            "non_compliant": self.non_compliant,
            "partial": self.partial,
            "not_assessed": self.not_assessed,
            "items": [
                {
                    "id": item.id,
                    "domain": item.domain,
                    "domain_ar": item.domain_ar,
                    "title_ar": item.title_ar,
                    "description_ar": item.description_ar,
                    "priority": item.priority,
                    "status": item.status,
                    "findings": item.findings,
                }
                for item in self.items
            ],
        }


SEVERITY_ORDER = {"critical": 4, "high": 3, "medium": 2, "low": 1, "info": 0}


def analyze_requirements(
    requirements: list[ComplianceItem],
    findings: list[dict],
    scan_type: str,
) -> FrameworkReport:
    """
    Core analysis engine shared by all frameworks.
    For each requirement:
      - If scan_type not in requirement.scan_types → not_assessed
      - Filter findings by matching categories
      - No matches → compliant
      - Any critical/high match → non_compliant
      - Medium match only → partial
      - Low/info only → compliant
    """
    import copy
    items = copy.deepcopy(requirements)

    for item in items:
        if scan_type not in item.scan_types:
            item.status = "not_assessed"
            continue

        matched = [
            f for f in findings
            if f.get("category", "") in item.categories
        ]

        if not matched:
            item.status = "compliant"
            continue

        max_sev = max(SEVERITY_ORDER.get(f.get("severity", "info"), 0) for f in matched)
        item.findings = [f.get("title_ar") or f.get("title", "") for f in matched[:5]]

        if max_sev >= 3:       # critical or high
            item.status = "non_compliant"
        elif max_sev == 2:     # medium
            item.status = "partial"
        else:                  # low / info
            item.status = "compliant"

    compliant_count    = sum(1 for i in items if i.status == "compliant")
    non_compliant_count= sum(1 for i in items if i.status == "non_compliant")
    partial_count      = sum(1 for i in items if i.status == "partial")
    not_assessed_count = sum(1 for i in items if i.status == "not_assessed")

    assessed = len(items) - not_assessed_count
    if assessed > 0:
        score = round((compliant_count + partial_count * 0.5) / assessed * 100)
    else:
        score = 100  # no data = no violations found

    return FrameworkReport(
        framework="",  # overridden by caller
        name_ar="",    # overridden by caller
        score=score,
        total=len(items),
        compliant=compliant_count,
        non_compliant=non_compliant_count,
        partial=partial_count,
        not_assessed=not_assessed_count,
        items=items,
    )
