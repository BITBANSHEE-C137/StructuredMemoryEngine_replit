import { useQuery } from "@tanstack/react-query";
import { API_ROUTES } from "@/lib/constants";
import { getQueryFn } from "@/lib/queryClient";

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
    // Override the default queryFn to handle 401 by returning null instead of throwing
    queryFn: getQueryFn({ on401: "returnNull" }),
    retry: false,
    refetchOnWindowFocus: true,
    refetchInterval: 5 * 60 * 1000, // Refresh auth status every 5 minutes
  });

  console.log("Auth status:", { 
    data, 
    isLoading, 
    isAuthenticated: !!data?.authenticated,
    hasError: !!error
  });

  return {
    isAuthenticated: !!data?.authenticated,
    user: data?.user || null,
    isLoading,
    error,
    refetch,
  };
}