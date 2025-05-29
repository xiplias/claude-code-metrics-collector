import { db, insertEvent } from "../lib/database";
import { corsHeaders, logRequest } from "../lib/utils";

export async function handlePostEvents(req: Request) {
  const startTime = Date.now();
  let requestBody: string | undefined;

  try {
    const data = await req.json();
    requestBody = JSON.stringify(data);

    insertEvent.run(
      data.event_type,
      data.event_name,
      data.project_path || null,
      data.user_id || null,
      data.session_id || null,
      data.duration_ms || null,
      JSON.stringify(data.metadata || {})
    );

    const responseTime = Date.now() - startTime;
    logRequest(req, "/events", 200, responseTime, undefined, requestBody);

    return Response.json(
      { success: true, message: "Event recorded" },
      { headers: corsHeaders }
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logRequest(
      req,
      "/events",
      500,
      responseTime,
      errorMessage,
      requestBody
    );

    return Response.json(
      { error: "Failed to record event", message: errorMessage },
      { headers: corsHeaders, status: 500 }
    );
  }
}

export async function handleGetEvents(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const events = db
    .query(
      `
      SELECT * FROM events 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `
    )
    .all(limit, offset);

  return Response.json({ events }, { headers: corsHeaders });
}