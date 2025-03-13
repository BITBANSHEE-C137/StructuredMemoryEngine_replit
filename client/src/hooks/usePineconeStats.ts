import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/constants';
import { queryClient } from '@/lib/queryClient';

export interface PineconeStats {
  enabled: boolean;
  vectorCount: number;
  activeIndex: string | null;
  namespaces: Array<{
    name: string;
    vectorCount: number;
  }>;
  // Deduplication metrics
  lastSyncDedupRate?: number;
  lastHydrateDedupRate?: number;
  avgDedupRate?: number;
}

export function usePineconeStats() {
  const queryKey = [API_ROUTES.PINECONE + '/stats'];
  
  const { data, isLoading, error, refetch } = useQuery<PineconeStats>({
    queryKey,
    refetchInterval: 30 * 1000, // Refresh more frequently (every 30 seconds)
    refetchOnWindowFocus: true,
    staleTime: 0, // Override the Infinity staleTime to ensure refetching
    gcTime: 1000 * 60 * 5, // 5 minutes
  });

  // Function to manually refresh stats
  const refreshStats = async () => {
    await queryClient.invalidateQueries({ queryKey });
    return refetch();
  };

  return {
    stats: data || {
      enabled: false,
      vectorCount: 0,
      activeIndex: null,
      namespaces: [],
    },
    isLoading,
    error,
    refetch: refreshStats,
  };
}