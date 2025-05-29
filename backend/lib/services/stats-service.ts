import { db } from "../database";

export interface StatsData {
  metrics: any[];
  events: any[];
  sessions: {
    total_sessions: number;
    unique_users: number;
    total_cost: number;
    total_input_tokens: number;
    total_output_tokens: number;
    total_cache_read_tokens: number;
    total_cache_creation_tokens: number;
    avg_cost_per_session: number;
    max_session_cost: number;
    total_messages: number;
    avg_cost_per_message: number;
  };
  recentSessions: any[];
  modelUsage: any[];
}

export function getMetricStats() {
  return db
    .query(
      `
      SELECT 
        metric_name,
        COUNT(*) as count,
        SUM(metric_value) as total,
        AVG(metric_value) as average,
        MIN(metric_value) as min,
        MAX(metric_value) as max
      FROM metrics
      GROUP BY metric_name
    `
    )
    .all();
}

export function getEventStats() {
  return db
    .query(
      `
      SELECT 
        event_type,
        event_name,
        COUNT(*) as count,
        AVG(duration_ms) as avg_duration_ms
      FROM events
      GROUP BY event_type, event_name
    `
    )
    .all();
}

export function getSessionStats() {
  return db
    .query(
      `
      SELECT 
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(DISTINCT user_id) as unique_users,
        SUM(total_cost) as total_cost,
        SUM(total_input_tokens) as total_input_tokens,
        SUM(total_output_tokens) as total_output_tokens,
        SUM(total_cache_read_tokens) as total_cache_read_tokens,
        SUM(total_cache_creation_tokens) as total_cache_creation_tokens,
        AVG(total_cost) as avg_cost_per_session,
        MAX(total_cost) as max_session_cost
      FROM sessions
    `
    )
    .get();
}

export function getMessageCount() {
  return db
    .query(`SELECT COUNT(*) as total_messages FROM messages`)
    .get();
}

export function getRecentSessions(limit: number = 10) {
  return db
    .query(
      `
      SELECT * FROM sessions
      ORDER BY last_seen DESC
      LIMIT ?
    `
    )
    .all(limit);
}

export function getModelUsage() {
  return db
    .query(
      `
      SELECT 
        model,
        COUNT(*) as message_count,
        SUM(cost) as total_cost,
        SUM(input_tokens) as total_input_tokens,
        SUM(output_tokens) as total_output_tokens,
        SUM(cache_read_tokens) as total_cache_read_tokens,
        SUM(cache_creation_tokens) as total_cache_creation_tokens,
        AVG(cost) as avg_cost_per_message
      FROM messages
      WHERE model IS NOT NULL
      GROUP BY model
      ORDER BY message_count DESC
    `
    )
    .all();
}

export function calculateStatsData(): StatsData {
  const metricStats = getMetricStats();
  const eventStats = getEventStats();
  const sessionStats = getSessionStats();
  const messageCount = getMessageCount();
  const recentSessions = getRecentSessions();
  const modelUsage = getModelUsage();

  // Calculate average cost per message
  const avgCostPerMessage = messageCount.total_messages > 0 
    ? sessionStats.total_cost / messageCount.total_messages 
    : 0;

  return {
    metrics: metricStats,
    events: eventStats,
    sessions: {
      ...sessionStats,
      total_messages: messageCount.total_messages,
      avg_cost_per_message: avgCostPerMessage,
    },
    recentSessions,
    modelUsage,
  };
}