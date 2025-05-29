import { Kysely, SqliteDialect } from 'kysely';
import { BunSqliteDialect } from 'kysely-bun-sqlite';
import { Database } from 'bun:sqlite';

// Database schema types
export interface DatabaseSchema {
  metrics: {
    id: number;
    timestamp: Date;
    metric_type: string;
    metric_name: string;
    metric_value: number | null;
    labels: string | null;
    project_path: string | null;
    user_id: string | null;
    session_id: string | null;
    metadata: string | null;
  };
  events: {
    id: number;
    timestamp: Date;
    event_type: string;
    event_name: string;
    project_path: string | null;
    user_id: string | null;
    session_id: string | null;
    duration_ms: number | null;
    metadata: string | null;
  };
  request_logs: {
    id: number;
    timestamp: Date;
    endpoint: string;
    method: string;
    ip_address: string | null;
    user_agent: string | null;
    request_body: string | null;
    response_status: number | null;
    response_time_ms: number | null;
    error_message: string | null;
    extracted_data: string | null;
  };
  sessions: {
    id: number;
    session_id: string;
    user_id: string | null;
    user_email: string | null;
    organization_id: string | null;
    model: string | null;
    total_cost: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_read_tokens: number;
    total_cache_creation_tokens: number;
    first_seen: Date;
    last_seen: Date;
  };
  messages: {
    id: number;
    message_id: string;
    session_id: string;
    conversation_id: string | null;
    role: string | null;
    model: string | null;
    cost: number;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    timestamp: Date;
  };
}

// Create Kysely instance for migrations
export const createDb = (databasePath: string = 'claude-metrics.db') => {
  return new Kysely<DatabaseSchema>({
    dialect: new BunSqliteDialect({
      database: new Database(databasePath),
    }),
  });
};

export const migrationDb = createDb();