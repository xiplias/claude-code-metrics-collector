// Centralized API client with consistent error handling

import { 
  Session, 
  SessionDetails, 
  SessionDetailsWithPagination,
  DashboardStats, 
  PaginatedMessages,
  SessionsListParams,
  MessagesListParams 
} from '../types';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    message: string, 
    public status: number, 
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.error || errorMessage;
      } catch {
        // If we can't parse the error response, use the default message
      }
      throw new ApiError(errorMessage, response.status, response);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    // Network or other errors
    throw new ApiError(
      error instanceof Error ? error.message : 'An unknown error occurred',
      0
    );
  }
}

export const apiClient = {
  // Dashboard
  async getStats(): Promise<DashboardStats> {
    return fetchJson<DashboardStats>(`${API_BASE}/stats`);
  },

  // Sessions
  async getSessions(params: SessionsListParams = {}): Promise<Session[]> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    
    const url = `${API_BASE}/sessions${searchParams.toString() ? `?${searchParams}` : ''}`;
    return fetchJson<Session[]>(url);
  },

  async getSessionDetails(sessionId: string): Promise<SessionDetails> {
    return fetchJson<SessionDetails>(`${API_BASE}/sessions/${sessionId}`);
  },

  async getSessionDetailsWithPagination(
    sessionId: string, 
    params: MessagesListParams
  ): Promise<SessionDetailsWithPagination> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.cursor) searchParams.set('cursor', params.cursor);
    
    const url = `${API_BASE}/sessions/${sessionId}?${searchParams}`;
    return fetchJson<SessionDetailsWithPagination>(url);
  },

  // Messages (paginated)
  async getSessionMessages(
    sessionId: string, 
    params: MessagesListParams
  ): Promise<PaginatedMessages> {
    const searchParams = new URLSearchParams();
    if (params.limit) searchParams.set('limit', params.limit.toString());
    if (params.offset) searchParams.set('offset', params.offset.toString());
    if (params.cursor) searchParams.set('cursor', params.cursor);
    
    const url = `${API_BASE}/sessions/${sessionId}/messages?${searchParams}`;
    return fetchJson<PaginatedMessages>(url);
  },

  // Logs
  async getLogs(): Promise<any[]> {
    return fetchJson<any[]>(`${API_BASE}/logs`);
  },

  // Health
  async getHealth(): Promise<{ status: string }> {
    return fetchJson<{ status: string }>('/health');
  },
};

export { ApiError };
export type { ApiError as ApiErrorType };