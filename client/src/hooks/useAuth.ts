import { useQuery } from "@tanstack/react-query";
import type { User } from "@shared/schema";

export function useAuth() {
  const { data: user, isLoading, error } = useQuery<User | null>({
    queryKey: ["/api/auth/user"],
    // No special on401 handling needed anymore, server returns null
    retry: false,
    staleTime: 1000 * 60 * 5, // 5 minutes - avoid unnecessary refetches
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    error,
  };
}
