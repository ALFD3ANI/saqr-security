import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import api from "@/services/api";
import { useAuthStore } from "@/stores/authStore";
import { useQueryClient } from "@tanstack/react-query";

type State = "verifying" | "success" | "failed" | "pending";

export default function PaymentCallback() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { updateUser } = useAuthStore();

  const moyasarId = params.get("id") ?? params.get("payment_id") ?? "";
  const statusParam = params.get("status") ?? "";

  const [state, setState] = useState<State>("verifying");
  const [plan, setPlan] = useState("");
  const [invoice, setInvoice] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!moyasarId) {
      setState("failed");
      setErrorMsg("لم يتم استلام معرف الدفعة");
      return;
    }

    async function verify() {
      try {
        const res = await api.post(`/subscriptions/payment/${moyasarId}/verify`);
        const data = res.data;

        if (data.success && data.status === "paid") {
          setPlan(data.plan ?? "");
          setInvoice(data.invoice_number ?? "");
          setState("success");
          qc.invalidateQueries({ queryKey: ["usage"] });
          // refresh user data
          try {
            const me = await api.get("/auth/me");
            updateUser(me.data);
          } catch {}
        } else if (data.status === "pending") {
          setState("pending");
        } else {
          setState("failed");
          setErrorMsg("فشلت عملية الدفع أو تم إلغاؤها");
        }
      } catch {
        // If status from URL is "paid" (mock dev flow), treat as success
        if (statusParam === "paid") {
          setState("success");
          qc.invalidateQueries({ queryKey: ["usage"] });
          try {
            const me = await api.get("/auth/me");
            updateUser(me.data);
          } catch {}
        } else {
          setState("failed");
          setErrorMsg("تعذّر التحقق من حالة الدفع");
        }
      }
    }

    verify();
  }, [moyasarId]);

  if (state === "verifying") {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 size={40} className="text-primary mx-auto animate-spin" />
          <p className="text-text-primary text-lg font-medium">جاري التحقق من الدفع...</p>
          <p className="text-text-muted text-sm">لا تغلق هذه الصفحة</p>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
        <div className="bg-bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">تم الدفع بنجاح!</h1>
            {plan && (
              <p className="text-text-muted">
                تم تفعيل خطة <span className="text-primary font-semibold">{plan}</span>
              </p>
            )}
          </div>
          {invoice && (
            <div className="bg-bg-dark rounded-xl p-3 text-sm">
              <span className="text-text-muted">رقم الفاتورة: </span>
              <span className="text-text-primary font-mono">{invoice}</span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="flex-1 bg-primary text-bg-dark font-semibold py-2.5 rounded-xl hover:bg-primary/90"
            >
              الذهاب للوحة التحكم
            </button>
            <button
              onClick={() => navigate("/billing")}
              className="flex-1 border border-border text-text-muted py-2.5 rounded-xl hover:bg-bg-dark text-sm"
            >
              عرض الفواتير
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
        <div className="bg-bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto">
            <Loader2 size={32} className="text-yellow-400 animate-spin" />
          </div>
          <h1 className="text-xl font-bold text-text-primary">الدفعة قيد المعالجة</h1>
          <p className="text-text-muted text-sm">
            سيتم تفعيل خطتك خلال دقائق. ستتلقى إشعاراً بالبريد الإلكتروني عند الانتهاء.
          </p>
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full bg-primary text-bg-dark font-semibold py-2.5 rounded-xl hover:bg-primary/90"
          >
            العودة للوحة التحكم
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-dark flex items-center justify-center p-4">
      <div className="bg-bg-card border border-border rounded-2xl p-8 max-w-md w-full text-center space-y-5">
        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
          <XCircle size={32} className="text-red-400" />
        </div>
        <h1 className="text-xl font-bold text-text-primary">فشلت عملية الدفع</h1>
        <p className="text-text-muted text-sm">{errorMsg || "حدث خطأ أثناء معالجة الدفعة"}</p>
        <div className="flex gap-3">
          <button
            onClick={() => navigate("/pricing")}
            className="flex-1 bg-primary text-bg-dark font-semibold py-2.5 rounded-xl hover:bg-primary/90"
          >
            المحاولة مجدداً
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex-1 border border-border text-text-muted py-2.5 rounded-xl hover:bg-bg-dark text-sm"
          >
            العودة
          </button>
        </div>
      </div>
    </div>
  );
}
