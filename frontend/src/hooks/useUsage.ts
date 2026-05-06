import { useQuery } from "@tanstack/react-query";
import { subscriptionApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

export interface UsageData {
  plan: string;
  scans_used: number;
  scans_limit: number;
  ai_chat_used: number;
  ai_chat_limit: number;
  ai_search_used: number;
  ai_search_limit: number;
  ai_cost_usd: number;
  scans_today: number;
  scans_daily_limit: number;
  ai_chat_today: number;
  ai_chat_daily_limit: number;
}

export function useUsage() {
  const { isAuthenticated } = useAuthStore();

  return useQuery<UsageData>({
    queryKey: ["usage"],
    queryFn: async () => {
      const res = await subscriptionApi.getUsage();
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 2, // refresh كل دقيقتين
    refetchOnWindowFocus: true,
  });
}

export function usePlans() {
  return useQuery({
    queryKey: ["plans"],
    queryFn: async () => {
      const res = await subscriptionApi.getPlans();
      return res.data.plans as any[];
    },
    staleTime: 1000 * 60 * 30,
  });
}
