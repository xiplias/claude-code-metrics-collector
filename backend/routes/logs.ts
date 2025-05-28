import { db } from "../database";
import { corsHeaders, logRequest } from "../utils";

export const logsRoutes = {
  // GET /logs - Query request logs
  "/logs": {
    async GET(req: Request) {
      const startTime = Date.now();

      try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const query = `
          SELECT * FROM request_logs
          ORDER BY timestamp DESC
          LIMIT ? OFFSET ?
        `;

        const logs = db.query(query).all(limit, offset);

        const responseTime = Date.now() - startTime;
        logRequest(req, "/logs", 200, responseTime);

        return Response.json(logs, { headers: corsHeaders });
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/logs", 500, responseTime, errorMessage);

        return Response.json(
          { error: "Failed to query logs", message: errorMessage },
          { headers: corsHeaders, status: 500 }
        );
      }
    },
  },
};