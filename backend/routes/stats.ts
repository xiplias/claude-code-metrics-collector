import { db } from "../lib/database";
import { corsHeaders } from "../lib/utils";

export async function handleGetStats(req: Request) {
  const metricStats = db
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

  const eventStats = db
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

  const sessionStats = db
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

  // Get total message count
  const messageCount = db
    .query(`SELECT COUNT(*) as total_messages FROM messages`)
    .get();

  // Calculate average cost per message
  const avgCostPerMessage = sessionStats.total_cost / messageCount.total_messages || 0;

  const recentSessions = db
    .query(
      `
      SELECT * FROM sessions
      ORDER BY last_seen DESC
      LIMIT 10
    `
    )
    .all();

  return Response.json(
    {
      metrics: metricStats,
      events: eventStats,
      sessions: {
        ...sessionStats,
        total_messages: messageCount.total_messages,
        avg_cost_per_message: avgCostPerMessage,
      },
      recentSessions,
    },
    { headers: corsHeaders }
  );
}