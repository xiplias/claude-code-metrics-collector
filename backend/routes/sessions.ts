import { db } from "../database";
import { corsHeaders, logRequest } from "../utils";

export const sessionsRoutes = {
  // GET /sessions - Query sessions
  "/sessions": {
    async GET(req: Request) {
      const startTime = Date.now();

      try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const query = `
          SELECT * FROM sessions
          ORDER BY last_seen DESC
          LIMIT ? OFFSET ?
        `;

        const sessions = db.query(query).all(limit, offset);

        const responseTime = Date.now() - startTime;
        logRequest(req, "/sessions", 200, responseTime);

        return Response.json(sessions, { headers: corsHeaders });
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/sessions", 500, responseTime, errorMessage);

        return Response.json(
          { error: "Failed to query sessions", message: errorMessage },
          { headers: corsHeaders, status: 500 }
        );
      }
    },
  },

  // GET /session/:id - Get individual session details
  "/session/:id": {
    async GET(req: Request) {
      const startTime = Date.now();

      try {
        const url = new URL(req.url);
        const sessionId = url.pathname.split('/').pop();

        if (!sessionId) {
          const responseTime = Date.now() - startTime;
          logRequest(req, "/session/:id", 400, responseTime, "Missing session ID");
          return Response.json(
            { error: "Session ID is required" },
            { headers: corsHeaders, status: 400 }
          );
        }

        // Get session details
        const session = db
          .query(`SELECT * FROM sessions WHERE session_id = ?`)
          .get(sessionId);

        if (!session) {
          const responseTime = Date.now() - startTime;
          logRequest(req, "/session/:id", 404, responseTime, "Session not found");
          return Response.json(
            { error: "Session not found" },
            { headers: corsHeaders, status: 404 }
          );
        }

        // Get session metrics
        const metrics = db
          .query(
            `
            SELECT metric_name, metric_value, timestamp, labels
            FROM metrics 
            WHERE session_id = ?
            ORDER BY timestamp DESC
          `
          )
          .all(sessionId);

        // Get session events
        const events = db
          .query(
            `
            SELECT event_type, event_name, duration_ms, timestamp, metadata
            FROM events 
            WHERE session_id = ?
            ORDER BY timestamp DESC
          `
          )
          .all(sessionId);

        // Get session messages
        const messages = db
          .query(
            `
            SELECT * FROM messages 
            WHERE session_id = ?
            ORDER BY timestamp DESC
          `
          )
          .all(sessionId);

        // Calculate session analytics
        const totalMetrics = metrics.length;
        const totalEvents = events.length;
        const avgEventDuration = events.reduce((sum, e) => sum + (e.duration_ms || 0), 0) / Math.max(events.length, 1);

        // Group metrics by type for analysis
        const metricsByType = metrics.reduce((acc, metric) => {
          if (!acc[metric.metric_name]) {
            acc[metric.metric_name] = [];
          }
          acc[metric.metric_name].push(metric.metric_value);
          return acc;
        }, {} as Record<string, number[]>);

        // Group events by type
        const eventsByType = events.reduce((acc, event) => {
          const key = `${event.event_type}.${event.event_name}`;
          if (!acc[key]) {
            acc[key] = [];
          }
          acc[key].push(event.duration_ms || 0);
          return acc;
        }, {} as Record<string, number[]>);

        const responseTime = Date.now() - startTime;
        logRequest(req, "/session/:id", 200, responseTime);

        return Response.json(
          {
            session,
            metrics,
            events,
            messages,
            analytics: {
              total_metrics: totalMetrics,
              total_events: totalEvents,
              total_messages: messages.length,
              avg_event_duration_ms: Math.round(avgEventDuration),
              metrics_by_type: Object.entries(metricsByType).map(([name, values]) => ({
                metric_name: name,
                count: values.length,
                total: values.reduce((a, b) => a + b, 0),
                average: values.reduce((a, b) => a + b, 0) / values.length,
                min: Math.min(...values),
                max: Math.max(...values),
              })),
              events_by_type: Object.entries(eventsByType).map(([name, durations]) => ({
                event_name: name,
                count: durations.length,
                avg_duration_ms: durations.reduce((a, b) => a + b, 0) / durations.length,
                min_duration_ms: Math.min(...durations),
                max_duration_ms: Math.max(...durations),
              })),
            },
          },
          { headers: corsHeaders }
        );
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/session/:id", 500, responseTime, errorMessage);

        return Response.json(
          { error: "Failed to get session details", message: errorMessage },
          { headers: corsHeaders, status: 500 }
        );
      }
    },
  },
};