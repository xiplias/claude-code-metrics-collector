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

export function calculateStatsData() {
  const metricStats = getMetricStats();
  const eventStats = getEventStats();
  const sessionStats = getSessionStats() as any;
  const messageCount = getMessageCount() as any;
  const recentSessions = getRecentSessions();
  const modelUsage = getModelUsage();

  // Calculate average cost per message
  const avgCostPerMessage = (messageCount?.total_messages || 0) > 0 
    ? (sessionStats?.total_cost || 0) / (messageCount?.total_messages || 1)
    : 0;

  // Return flattened structure that matches frontend expectations
  return {
    // Flatten session stats to top level
    total_sessions: sessionStats?.total_sessions || 0,
    unique_users: sessionStats?.unique_users || 0,
    total_cost: sessionStats?.total_cost || 0,
    total_input_tokens: sessionStats?.total_input_tokens || 0,
    total_output_tokens: sessionStats?.total_output_tokens || 0,
    total_cache_read_tokens: sessionStats?.total_cache_read_tokens || 0,
    total_cache_creation_tokens: sessionStats?.total_cache_creation_tokens || 0,
    avg_cost_per_session: sessionStats?.avg_cost_per_session || 0,
    max_session_cost: sessionStats?.max_session_cost || 0,
    total_messages: messageCount?.total_messages || 0,
    avg_cost_per_message: avgCostPerMessage,
    
    // Frontend expects cost_by_model, not modelUsage
    cost_by_model: modelUsage || [],
    
    // Keep the nested data for completeness
    metrics: metricStats || [],
    events: eventStats || [],
    recent_sessions: recentSessions || [],
  };
}