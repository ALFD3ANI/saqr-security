"""
نتائج الفحص — الهياكل المشتركة بين كل أنواع الفحص
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class Finding:
    severity:         str           # critical | high | medium | low | info
    category:         str           # ssl | headers | content | network | config | auth
    title:            str
    title_ar:         str
    description:      str
    recommendation:   str
    evidence:         Optional[str] = None
    cwe_id:           Optional[str] = None
    cvss_score:       Optional[float] = None
    attack_scenario:  Optional[str] = None   # كيف يستغل المهاجم هذه الثغرة


@dataclass
class ScanResult:
    findings:   list[Finding] = field(default_factory=list)
    risk_score: int = 0
    risk_level: str = "unknown"
    summary:    dict = field(default_factory=dict)
    error:      Optional[str] = None

    def compute_risk(self) -> None:
        score = 0
        counts = {"critical": 0, "high": 0, "medium": 0, "low": 0, "info": 0}
        for f in self.findings:
            counts[f.severity] = counts.get(f.severity, 0) + 1
            score += {"critical": 40, "high": 20, "medium": 10, "low": 5, "info": 1}.get(f.severity, 0)

        self.risk_score = min(score, 100)
        if self.risk_score >= 70:   self.risk_level = "critical"
        elif self.risk_score >= 50: self.risk_level = "high"
        elif self.risk_score >= 25: self.risk_level = "medium"
        elif self.risk_score > 0:   self.risk_level = "low"
        else:                       self.risk_level = "low"

        self.summary = {
            "total": len(self.findings),
            "critical": counts["critical"],
            "high": counts["high"],
            "medium": counts["medium"],
            "low": counts["low"],
            "info": counts["info"],
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
        }
