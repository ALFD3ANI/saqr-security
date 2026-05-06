from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from app.models.user import UserPlan


class UsageStats(BaseModel):
    plan: str
    # شهري
    scans_used: int
    scans_limit: int
    ai_chat_used: int
    ai_chat_limit: int
    ai_search_used: int
    ai_search_limit: int
    ai_cost_usd: float
    # يومي
    scans_today: int
    scans_daily_limit: int
    ai_chat_today: int
    ai_chat_daily_limit: int
    # تواريخ
    period_year: int
    period_month: int

    model_config = {"from_attributes": True}


class PlanInfo(BaseModel):
    plan: str
    price_monthly_sar: float
    price_annual_sar: float
    scans_per_month: int
    scans_per_day: int
    websites: int
    ai_chat_per_month: int
    ai_chat_per_day: int
    ai_search_per_month: int
    ai_models: list[str]
    features: list[str]


class UpgradePlanRequest(BaseModel):
    plan: UserPlan
    billing: str = "monthly"  # monthly / annual
