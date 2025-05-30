import { testDb } from "../test-database";

export interface SessionsListParams {
  limit: number;
  offset: number;
}

export interface SessionDetailData {
  session: any;
  messages: any[];
  events: any[];
  metrics: any[];
}

export function getSessions(params: SessionsListParams) {
  return testDb
    .query(
      `
      SELECT * FROM sessions
      ORDER BY last_seen DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(params.limit, params.offset);
}

export function getSessionById(sessionId: string): any | null {
  return testDb
    .query(`SELECT * FROM sessions WHERE session_id = ?`)
    .get(sessionId);
}

export function getSessionMessages(sessionId: string) {
  return testDb
    .query(
      `
      SELECT * FROM messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `
    )
    .all(sessionId);
}

export function getSessionEvents(sessionId: string) {
  return testDb
    .query(
      `
      SELECT * FROM events
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `
    )
    .all(sessionId);
}

export function getSessionMetrics(sessionId: string) {
  return testDb
    .query(
      `
      SELECT * FROM metrics
      WHERE session_id = ?
      ORDER BY timestamp DESC
    `
    )
    .all(sessionId);
}

export function getSessionDetails(sessionId: string): SessionDetailData | null {
  const session = getSessionById(sessionId);
  
  if (!session) {
    return null;
  }

  const messages = getSessionMessages(sessionId);
  const events = getSessionEvents(sessionId);
  const metrics = getSessionMetrics(sessionId);

  // Enhance messages with their associated metrics
  const enhancedMessages = messages.map(message => {
    // Find metrics that reference this message
    const messageMetrics = metrics.filter(metric => {
      try {
        const labels = JSON.parse(metric.labels || '{}');
        return labels.message_id === message.message_id || labels['message.id'] === message.message_id;
      } catch {
        return false;
      }
    });

    // Extract unique metric types for this message
    const metricTypes = [...new Set(messageMetrics.map(m => m.metric_name))];

    return {
      ...message,
      metric_types: metricTypes
    };
  });

  return {
    session,
    messages: enhancedMessages,
    events,
    metrics,
  };
}