export type Plan = "free" | "starter" | "professional" | "business" | "enterprise";
export type AccountStatus = "pending_payment" | "pending_approval" | "active" | "suspended" | "banned" | "expired" | "rejected" | "cancelled";
export type UserRole = "user" | "admin" | "super_admin";

export interface PlanConfig {
  name: string;
  nameAr: string;
  color: string;
  bgColor: string;
  borderColor: string;
  scansPerMonth: number;
  scansPerDay: number;
  websites: number;
  aiChatPerMonth: number;
  aiChatPerDay: number;
  aiSearchPerMonth: number;
}

// AI model access per plan (mirrors backend PLAN_LIMITS)
export const PLAN_LIMITS_FE: Record<string, { aiModels: string[] }> = {
  free:         { aiModels: ["haiku"] },
  starter:      { aiModels: ["haiku"] },
  professional: { aiModels: ["haiku", "sonnet"] },
  business:     { aiModels: ["haiku", "sonnet"] },
  enterprise:   { aiModels: ["haiku", "sonnet", "opus"] },
};

export const PLAN_CONFIG: Record<Plan, PlanConfig> = {
  free: {
    name: "Free", nameAr: "مجاني",
    color: "text-slate-400", bgColor: "bg-slate-800", borderColor: "border-slate-700",
    scansPerMonth: 3, scansPerDay: 1, websites: 1,
    aiChatPerMonth: 10, aiChatPerDay: 5, aiSearchPerMonth: 20,
  },
  starter: {
    name: "Starter", nameAr: "أساسي",
    color: "text-blue-400", bgColor: "bg-blue-900/20", borderColor: "border-blue-800",
    scansPerMonth: 25, scansPerDay: 5, websites: 5,
    aiChatPerMonth: 200, aiChatPerDay: 20, aiSearchPerMonth: 500,
  },
  professional: {
    name: "Professional", nameAr: "احترافي",
    color: "text-amber-400", bgColor: "bg-amber-900/20", borderColor: "border-amber-800",
    scansPerMonth: 100, scansPerDay: 20, websites: 20,
    aiChatPerMonth: 1000, aiChatPerDay: 100, aiSearchPerMonth: 3000,
  },
  business: {
    name: "Business", nameAr: "تجاري",
    color: "text-purple-400", bgColor: "bg-purple-900/20", borderColor: "border-purple-800",
    scansPerMonth: 500, scansPerDay: 100, websites: 100,
    aiChatPerMonth: 5000, aiChatPerDay: 500, aiSearchPerMonth: 15000,
  },
  enterprise: {
    name: "Enterprise", nameAr: "مؤسسي",
    color: "text-emerald-400", bgColor: "bg-emerald-900/20", borderColor: "border-emerald-800",
    scansPerMonth: 10000, scansPerDay: 1000, websites: -1,
    aiChatPerMonth: 50000, aiChatPerDay: 2000, aiSearchPerMonth: 150000,
  },
};
