import { serve } from "bun";
import index from "../src/index.html";
import { corsHeaders, logRequest } from "./lib/utils";
import { processOTLPMetrics } from "./lib/otlp";
import { db, insertMetric, insertEvent } from "./lib/database";

// Route definitions
const routes = {
  // GET / - Serve the React app
  "/": {
    async GET() {
      return new Response(index, {
        headers: { "Content-Type": "text/html", ...corsHeaders },
      });
    },
  },

  // GET /metrics - Get stored metrics
  "/metrics": {
    async GET(req) {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") || "100");
      const offset = parseInt(url.searchParams.get("offset") || "0");

      const metrics = db
        .query(
          `
          SELECT * FROM metrics 
          ORDER BY timestamp DESC 
          LIMIT ? OFFSET ?
        `
        )
        .all(limit, offset);

      return Response.json({ metrics }, { headers: corsHeaders });
    },

    // POST /metrics - Store custom metrics
    async POST(req) {
      const startTime = Date.now();
      let requestBody: string | undefined;

      try {
        requestBody = await req.text();
        const data = JSON.parse(requestBody);

        insertMetric.run(
          data.type || "gauge",
          data.name,
          data.value || 0,
          JSON.stringify(data.labels || {}),
          data.project_path || null,
          data.user_id || null,
          data.session_id || null,
          JSON.stringify(data.metadata || {})
        );

        const responseTime = Date.now() - startTime;
        logRequest(req, "/metrics", 200, responseTime, undefined, requestBody);

        return Response.json(
          { success: true, message: "Metric stored" },
          { headers: corsHeaders }
        );
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/metrics", 400, responseTime, errorMessage, requestBody);

        return Response.json(
          { error: errorMessage },
          { status: 400, headers: corsHeaders }
        );
      }
    },
  },

  // GET /events - Get stored events
  "/events": {
    async GET(req) {
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
    },

    // POST /events - Store custom events
    async POST(req) {
      const startTime = Date.now();
      let requestBody: string | undefined;

      try {
        requestBody = await req.text();
        const data = JSON.parse(requestBody);

        insertEvent.run(
          data.type || "custom",
          data.name,
          data.project_path || null,
          data.user_id || null,
          data.session_id || null,
          data.duration_ms || null,
          JSON.stringify(data.metadata || {})
        );

        const responseTime = Date.now() - startTime;
        logRequest(req, "/events", 200, responseTime, undefined, requestBody);

        return Response.json(
          { success: true, message: "Event stored" },
          { headers: corsHeaders }
        );
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/events", 400, responseTime, errorMessage, requestBody);

        return Response.json(
          { error: errorMessage },
          { status: 400, headers: corsHeaders }
        );
      }
    },
  },

  // GET /stats - Get summary statistics
  "/stats": {
    async GET(req) {
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
    },
  },

  // GET /sessions - Get all sessions
  "/sessions": {
    async GET(req) {
      const url = new URL(req.url);
      const limit = parseInt(url.searchParams.get("limit") || "50");
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
    },
  },

  // GET /sessions/:sessionId - Get specific session details
  "/sessions/:sessionId": {
    async GET(req) {
      const url = new URL(req.url);
      const sessionId = url.pathname.split("/sessions/")[1];

      if (!sessionId) {
        return Response.json(
          { error: "Session ID is required" },
          { status: 400, headers: corsHeaders }
        );
      }

      // Get session details
      const session = db
        .query(`SELECT * FROM sessions WHERE session_id = ?`)
        .get(sessionId);

      if (!session) {
        return Response.json(
          { error: "Session not found" },
          { status: 404, headers: corsHeaders }
        );
      }

      // Get messages for this session
      const messages = db
        .query(
          `
          SELECT * FROM messages 
          WHERE session_id = ? 
          ORDER BY timestamp ASC
        `
        )
        .all(sessionId);

      // Get metrics for this session
      const metrics = db
        .query(
          `
          SELECT * FROM metrics 
          WHERE session_id = ? 
          ORDER BY timestamp DESC
        `
        )
        .all(sessionId);

      // Get events for this session
      const events = db
        .query(
          `
          SELECT * FROM events 
          WHERE session_id = ? 
          ORDER BY timestamp DESC
        `
        )
        .all(sessionId);

      return Response.json(
        {
          session,
          messages,
          metrics,
          events,
        },
        { headers: corsHeaders }
      );
    },
  },

  // GET /logs - Get request logs
  "/logs": {
    async GET(req) {
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
    },
  },

  // POST /v1/metrics - OTLP endpoint
  "/v1/metrics": {
    async POST(req) {
      const startTime = Date.now();
      let requestBody: string | undefined;

      try {
        requestBody = await req.text();
        const data = JSON.parse(requestBody);

        // Process OTLP metrics
        processOTLPMetrics(data);

        const responseTime = Date.now() - startTime;
        logRequest(req, "/v1/metrics", 200, responseTime, undefined, requestBody);

        return Response.json(
          { success: true },
          { status: 200, headers: corsHeaders }
        );
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/v1/metrics", 500, responseTime, errorMessage, requestBody);

        console.error("OTLP processing error:", error);
        return Response.json(
          { error: "Internal server error" },
          { status: 500, headers: corsHeaders }
        );
      }
    },
  },

  // GET /health - Health check
  "/health": {
    async GET() {
      return Response.json(
        { status: "ok", timestamp: new Date().toISOString() },
        { headers: corsHeaders }
      );
    },
  },
};

// Route handler
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method;

  // Handle CORS preflight
  if (method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Find matching route
  let handler: any = null;
  let matchedPath = "";

  // Try exact match first
  if (routes[url.pathname as keyof typeof routes]) {
    handler = routes[url.pathname as keyof typeof routes][method as keyof typeof routes[keyof typeof routes]];
    matchedPath = url.pathname;
  } else {
    // Try pattern matching for dynamic routes
    for (const [path, routeHandlers] of Object.entries(routes)) {
      if (path.includes(":")) {
        const pathPattern = path.replace(/:[^/]+/g, "([^/]+)");
        const regex = new RegExp(`^${pathPattern}$`);
        if (regex.test(url.pathname)) {
          handler = (routeHandlers as any)[method];
          matchedPath = path;
          break;
        }
      }
    }
  }

  if (handler) {
    return await handler(req);
  }

  return new Response("Not Found", { status: 404, headers: corsHeaders });
}

// Start the server
const server = serve({
  port: 3001,
  fetch: handleRequest,
});

console.log("🚀 Backend server running at http://localhost:3001/");
console.log(`
Available endpoints:
    GET  /            - React frontend
    GET  /health      - Health check
    GET  /metrics     - Get metrics
    POST /metrics     - Store metrics
    GET  /events      - Get events
    POST /events      - Store events
    GET  /stats       - Get summary statistics
    GET  /sessions    - Get all sessions
    GET  /sessions/:id - Get session details
    GET  /logs        - Get request logs
    POST /v1/metrics  - OTLP metrics endpoint
`);