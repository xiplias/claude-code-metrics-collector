// Custom hooks for data fetching with react-query

import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';
import { 
  Session, 
  SessionDetails, 
  DashboardStats, 
  PaginatedMessages,
  SessionsListParams,
  MessagesListParams 
} from '../types';

// Query keys for cache management
export const queryKeys = {
  stats: ['stats'] as const,
  sessions: (params?: SessionsListParams) => ['sessions', params] as const,
  sessionDetails: (sessionId: string) => ['sessions', sessionId] as const,
  sessionMessages: (sessionId: string, params?: MessagesListParams) => 
    ['sessions', sessionId, 'messages', params] as const,
  logs: ['logs'] as const,
  health: ['health'] as const,
};

// Dashboard hooks
export function useStats(options: { refetchInterval?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: apiClient.getStats,
    refetchInterval: options.refetchInterval || 5000, // 5 seconds
    staleTime: 2000, // Consider fresh for 2 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
}

// Sessions hooks
export function useSessions(params: SessionsListParams = {}) {
  return useQuery({
    queryKey: queryKeys.sessions(params),
    queryFn: () => apiClient.getSessions(params),
    refetchInterval: 5000, // 5 seconds
    staleTime: 2000,
  });
}

export function useSessionDetails(sessionId: string) {
  return useQuery({
    queryKey: queryKeys.sessionDetails(sessionId),
    queryFn: () => apiClient.getSessionDetails(sessionId),
    refetchInterval: 5000, // 5 seconds
    staleTime: 2000,
    enabled: !!sessionId,
  });
}

// Infinite scrolling for messages
export function useSessionMessagesInfinite(sessionId: string, limit = 20) {
  return useInfiniteQuery({
    queryKey: queryKeys.sessionMessages(sessionId, { limit }),
    queryFn: ({ pageParam = 0 }) => 
      apiClient.getSessionMessages(sessionId, { 
        limit, 
        offset: pageParam as number 
      }),
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore) return undefined;
      return allPages.length * limit; // Next offset
    },
    initialPageParam: 0,
    refetchInterval: 5000, // 5 seconds
    staleTime: 2000,
    enabled: !!sessionId,
  });
}

// Regular paginated messages hook
export function useSessionMessages(sessionId: string, params: MessagesListParams) {
  return useQuery({
    queryKey: queryKeys.sessionMessages(sessionId, params),
    queryFn: () => apiClient.getSessionMessages(sessionId, params),
    refetchInterval: 5000, // 5 seconds
    staleTime: 2000,
    enabled: !!sessionId,
  });
}

// Logs hook
export function useLogs() {
  return useQuery({
    queryKey: queryKeys.logs,
    queryFn: apiClient.getLogs,
    refetchInterval: 5000, // 5 seconds
    staleTime: 2000,
  });
}

// Health check hook
export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: apiClient.getHealth,
    refetchInterval: 60000, // 1 minute
    staleTime: 30000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
}

// Utility hook for prefetching
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetchSessionDetails = (sessionId: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.sessionDetails(sessionId),
      queryFn: () => apiClient.getSessionDetails(sessionId),
      staleTime: 5000,
    });
  };

  const prefetchNextMessages = (sessionId: string, currentOffset: number, limit = 20) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.sessionMessages(sessionId, { 
        limit, 
        offset: currentOffset + limit 
      }),
      queryFn: () => apiClient.getSessionMessages(sessionId, { 
        limit, 
        offset: currentOffset + limit 
      }),
      staleTime: 10000,
    });
  };

  return {
    prefetchSessionDetails,
    prefetchNextMessages,
  };
}

// Import useQueryClient for prefetch hook
import { useQueryClient } from '@tanstack/react-query';