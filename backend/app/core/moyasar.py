"""
Moyasar Payment Gateway — بوابة الدفع موي
وثائق: https://moyasar.com/docs
"""
import hmac
import hashlib
import json
from typing import Optional

import httpx

from app.core.config import settings

MOYASAR_BASE = "https://api.moyasar.com/v1"


async def create_payment(
    amount_halala: int,       # 1 SAR = 100 halala
    description: str,
    callback_url: str,
    metadata: Optional[dict] = None,
    source_type: str = "creditcard",
) -> dict:
    """إنشاء عملية دفع جديدة في Moyasar"""
    if not settings.MOYASAR_API_KEY:
        # بيئة التطوير: إرجاع استجابة وهمية
        import uuid
        mock_id = f"mock_{uuid.uuid4().hex[:12]}"
        return {
            "id": mock_id,
            "status": "initiated",
            "amount": amount_halala,
            "currency": "SAR",
            "description": description,
            "source": {
                "type": source_type,
                "transaction_url": f"{settings.FRONTEND_URL}/payment/callback?id={mock_id}&status=paid",
            },
            "_mock": True,
        }

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{MOYASAR_BASE}/payments",
            auth=(settings.MOYASAR_API_KEY, ""),
            json={
                "amount": amount_halala,
                "currency": "SAR",
                "description": description,
                "callback_url": callback_url,
                "source": {"type": source_type},
                "metadata": metadata or {},
            },
        )
        resp.raise_for_status()
        return resp.json()


async def get_payment(moyasar_id: str) -> dict:
    """استرجاع حالة دفعة من Moyasar"""
    if moyasar_id.startswith("mock_"):
        return {"id": moyasar_id, "status": "paid", "_mock": True}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{MOYASAR_BASE}/payments/{moyasar_id}",
            auth=(settings.MOYASAR_API_KEY, ""),
        )
        resp.raise_for_status()
        return resp.json()


def verify_webhook_signature(payload: bytes, signature: str) -> bool:
    """التحقق من صحة توقيع Webhook"""
    if not settings.MOYASAR_WEBHOOK_SECRET:
        if settings.APP_ENV == "production":
            return False  # رفض كل webhooks بدون secret في الإنتاج
        return True  # dev only: تجاهل التحقق
    expected = hmac.new(
        settings.MOYASAR_WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, signature)


def generate_invoice_number(user_id: int, payment_id: int) -> str:
    """رقم الفاتورة بصيغة ZATCA"""
    from datetime import date
    today = date.today()
    return f"SQR-{today.year}{today.month:02d}-{user_id:04d}-{payment_id:05d}"
