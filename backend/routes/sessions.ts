import { db } from "../lib/database";
import { corsHeaders } from "../lib/utils";

export async function handleGetSessions(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const sessions = db
    .query(
      `
      SELECT * FROM sessions
      ORDER BY last_seen DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset);

  return Response.json({ sessions }, { headers: corsHeaders });
}

export async function handleGetSessionById(req: Request, params: { id: string }) {
  const sessionId = params.id;

  // Get session info
  const session = db
    .query(`SELECT * FROM sessions WHERE session_id = ?`)
    .get(sessionId);

  if (!session) {
    return Response.json(
      { error: "Session not found" },
      { headers: corsHeaders, status: 404 }
    );
  }

  // Get all messages for this session
  const messages = db
    .query(
      `
      SELECT * FROM messages
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `
    )
    .all(sessionId);

  // Get all events for this session
  const events = db
    .query(
      `
      SELECT * FROM events
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `
    )
    .all(sessionId);

  // Get all metrics for this session
  const metrics = db
    .query(
      `
      SELECT * FROM metrics
      WHERE session_id = ?
      ORDER BY timestamp DESC
    `
    )
    .all(sessionId);

  return Response.json(
    {
      session,
      messages,
      events,
      metrics,
    },
    { headers: corsHeaders }
  );
}