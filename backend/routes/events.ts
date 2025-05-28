import { db, insertEvent } from "../database";
import { corsHeaders, logRequest } from "../utils";

export const eventsRoutes = {
  // POST /events - Record an event
  "/events": {
    async POST(req: Request) {
      const startTime = Date.now();
      let requestBody: string | undefined;

      try {
        const body = await req.json();
        requestBody = JSON.stringify(body);

        insertEvent.run(
          body.event_type,
          body.event_name,
          body.project_path || null,
          body.user_id || null,
          body.session_id || null,
          body.duration_ms || null,
          JSON.stringify(body.metadata || {})
        );

        const responseTime = Date.now() - startTime;
        logRequest(req, "/events", 200, responseTime, undefined, requestBody);

        return Response.json({ success: true }, { headers: corsHeaders });
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/events", 500, responseTime, errorMessage, requestBody);

        return Response.json(
          { error: "Failed to record event", message: errorMessage },
          { headers: corsHeaders, status: 500 }
        );
      }
    },

    // GET /events - Query events
    async GET(req: Request) {
      const startTime = Date.now();

      try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const query = `
          SELECT * FROM events
          ORDER BY timestamp DESC
          LIMIT ? OFFSET ?
        `;

        const events = db.query(query).all(limit, offset);

        const responseTime = Date.now() - startTime;
        logRequest(req, "/events", 200, responseTime);

        return Response.json(events, { headers: corsHeaders });
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/events", 500, responseTime, errorMessage);

        return Response.json(
          { error: "Failed to query events", message: errorMessage },
          { headers: corsHeaders, status: 500 }
        );
      }
    },
  },
};