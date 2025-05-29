import { db } from "../database";

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
  return db
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
  return db
    .query(`SELECT * FROM sessions WHERE session_id = ?`)
    .get(sessionId);
}

export function getSessionMessages(sessionId: string) {
  return db
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
  return db
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
  return db
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

  return {
    session,
    messages,
    events,
    metrics,
  };
}