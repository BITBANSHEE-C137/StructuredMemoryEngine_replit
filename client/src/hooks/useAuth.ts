import { useQuery } from "@tanstack/react-query";
import { API_ROUTES } from "@/lib/constants";

interface UserInfo {
  id: string;
  name: string;
  roles?: string[];
  profileImage?: string;
}

interface AuthResponse {
  authenticated: boolean;
  user: UserInfo | null;
}

export function useAuth() {
  const { data, isLoading, error, refetch } = useQuery<AuthResponse>({
    queryKey: [API_ROUTES.AUTH.USER],
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refresh auth status every 5 minutes
  });

  return {
    isAuthenticated: !!data?.authenticated,
    user: data?.user || null,
    isLoading,
    error,
    refetch,
  };
}