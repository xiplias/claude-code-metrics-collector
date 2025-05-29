import { insertEvent } from "../database";
import { db } from "../database";

export interface EventData {
  event_type: string;
  event_name: string;
  project_path?: string;
  user_id?: string;
  session_id?: string;
  duration_ms?: number;
  metadata?: Record<string, any>;
}

export interface EventsListParams {
  limit: number;
  offset: number;
}

export function recordEvent(data: EventData): void {
  insertEvent.run(
    data.event_type,
    data.event_name,
    data.project_path || null,
    data.user_id || null,
    data.session_id || null,
    data.duration_ms || null,
    JSON.stringify(data.metadata || {})
  );
}

export function getEvents(params: EventsListParams) {
  return db
    .query(
      `
      SELECT * FROM events 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `
    )
    .all(params.limit, params.offset);
}

export function validateEventData(data: any): { isValid: boolean; error?: string } {
  if (!data.event_type) {
    return { isValid: false, error: "event_type is required" };
  }

  if (!data.event_name) {
    return { isValid: false, error: "event_name is required" };
  }

  if (data.duration_ms !== undefined && typeof data.duration_ms !== "number") {
    return { isValid: false, error: "duration_ms must be a number" };
  }

  return { isValid: true };
}

export function parseEventData(data: any): EventData {
  return {
    event_type: data.event_type,
    event_name: data.event_name,
    project_path: data.project_path,
    user_id: data.user_id,
    session_id: data.session_id,
    duration_ms: data.duration_ms,
    metadata: data.metadata,
  };
}