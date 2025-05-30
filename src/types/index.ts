// Shared TypeScript interfaces and types

export interface Session {
  id: number;
  session_id: string;
  user_id: string;
  user_email: string;
  organization_id: string;
  model: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  first_seen: string;
  last_seen: string;
}

export interface Message {
  id: number;
  message_id: string;
  session_id: string;
  conversation_id: string | null;
  role: string | null;
  model: string;
  cost: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
  timestamp: string;
  metric_types: string[];
}

export interface SessionDetails {
  session: Session;
  messages: Message[];
  events: any[];
  metrics: any[];
}

export interface PaginatedMessages {
  messages: Message[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export interface SessionDetailsWithPagination {
  session: Session;
  messages: PaginatedMessages;
  events: any[];
  metrics: any[];
}

export interface DashboardStats {
  total_sessions: number;
  total_cost: number;
  total_messages: number;
  avg_cost_per_message: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  cost_by_model: Array<{
    model: string;
    total_cost: number;
    message_count: number;
  }>;
  recent_sessions: Session[];
}

export interface ApiResponse<T> {
  data: T;
  error?: string;
}

export interface PaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
}

export interface SessionsListParams extends PaginationParams {
  // Additional filters can be added here
}

export interface MessagesListParams extends PaginationParams {
  sessionId: string;
}