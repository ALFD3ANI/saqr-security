import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/services/api";
import { useAuthStore } from "@/stores/authStore";

export function useCurrentUser() {
  const { isAuthenticated, updateUser } = useAuthStore();

  return useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await authApi.getMe();
      updateUser(res.data);
      return res.data;
    },
    enabled: isAuthenticated,
    staleTime: 1000 * 60 * 5, // 5 دقائق
    retry: false,
  });
}
