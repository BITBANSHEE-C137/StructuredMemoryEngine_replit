import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { API_ROUTES } from '@/lib/constants';

export interface PineconeStats {
  enabled: boolean;
  vectorCount: number;
  activeIndex: string | null;
  namespaces: Array<{
    name: string;
    vectorCount: number;
  }>;
}

export function usePineconeStats() {
  const { data, isLoading, error, refetch } = useQuery<PineconeStats>({
    queryKey: [API_ROUTES.PINECONE + '/stats'],
    refetchInterval: 60 * 1000, // Refresh every minute
    refetchOnWindowFocus: true,
  });

  return {
    stats: data || {
      enabled: false,
      vectorCount: 0,
      activeIndex: null,
      namespaces: [],
    },
    isLoading,
    error,
    refetch,
  };
}