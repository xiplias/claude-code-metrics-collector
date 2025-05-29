import { db } from "../lib/database";
import { corsHeaders } from "../lib/utils";

export async function handleGetLogs(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const logs = db
    .query(
      `
      SELECT * FROM request_logs 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset);

  return Response.json({ logs }, { headers: corsHeaders });
}