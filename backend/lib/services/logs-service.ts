import { db } from "../database";

export interface LogsListParams {
  limit: number;
  offset: number;
}

export function getLogs(params: LogsListParams) {
  return db
    .query(
      `
      SELECT * FROM request_logs 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `
    )
    .all(params.limit, params.offset);
}

export function getLogsCount() {
  const result = db.query(`SELECT COUNT(*) as count FROM request_logs`).get();
  return result?.count || 0;
}

export function parseLogsParams(url: URL): LogsListParams {
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");
  
  return { limit, offset };
}