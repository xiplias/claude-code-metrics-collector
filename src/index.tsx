import { serve } from "bun";
import { Database } from "bun:sqlite";
import index from "./index.html";

// Initialize SQLite database
const db = new Database("claude-metrics.db");

// Create tables if they don't exist
db.run(`
  CREATE TABLE IF NOT EXISTS metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    metric_type TEXT NOT NULL,
    metric_name TEXT NOT NULL,
    metric_value REAL,
    labels TEXT,
    project_path TEXT,
    user_id TEXT,
    session_id TEXT,
    metadata TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    event_type TEXT NOT NULL,
    event_name TEXT NOT NULL,
    project_path TEXT,
    user_id TEXT,
    session_id TEXT,
    duration_ms INTEGER,
    metadata TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS request_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    request_body TEXT,
    response_status INTEGER,
    response_time_ms INTEGER,
    error_message TEXT
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    user_id TEXT,
    user_email TEXT,
    organization_id TEXT,
    model TEXT,
    total_cost REAL DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cache_read_tokens INTEGER DEFAULT 0,
    total_cache_creation_tokens INTEGER DEFAULT 0,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id TEXT UNIQUE NOT NULL,
    session_id TEXT NOT NULL,
    conversation_id TEXT,
    role TEXT,
    model TEXT,
    cost REAL DEFAULT 0,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(session_id)
  )
`);

// Prepare statements for better performance
const insertMetric = db.prepare(`
  INSERT INTO metrics (metric_type, metric_name, metric_value, labels, project_path, user_id, session_id, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertEvent = db.prepare(`
  INSERT INTO events (event_type, event_name, project_path, user_id, session_id, duration_ms, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertLog = db.prepare(`
  INSERT INTO request_logs (endpoint, method, ip_address, user_agent, request_body, response_status, response_time_ms, error_message)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const upsertSession = db.prepare(`
  INSERT INTO sessions (session_id, user_id, user_email, organization_id, model)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(session_id) DO UPDATE SET
    last_seen = CURRENT_TIMESTAMP
`);

const updateSessionCost = db.prepare(`
  UPDATE sessions 
  SET total_cost = total_cost + ?,
      total_input_tokens = total_input_tokens + ?,
      total_output_tokens = total_output_tokens + ?,
      total_cache_read_tokens = total_cache_read_tokens + ?,
      total_cache_creation_tokens = total_cache_creation_tokens + ?,
      last_seen = CURRENT_TIMESTAMP
  WHERE session_id = ?
`);

const insertMessage = db.prepare(`
  INSERT INTO messages (message_id, session_id, conversation_id, role, model, cost, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateMessageTokens = db.prepare(`
  UPDATE messages 
  SET input_tokens = input_tokens + ?,
      output_tokens = output_tokens + ?,
      cache_read_tokens = cache_read_tokens + ?,
      cache_creation_tokens = cache_creation_tokens + ?
  WHERE message_id = ?
`);

// Helper function to extract attributes from OTLP data
function extractAttributes(attributes: any[]): Record<string, any> {
  const result: Record<string, any> = {};
  if (!attributes) return result;

  for (const attr of attributes) {
    const key = attr.key;
    const value =
      attr.value?.stringValue ||
      attr.value?.intValue ||
      attr.value?.doubleValue ||
      attr.value?.boolValue;
    if (key && value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

// Process OTLP metrics data
function processOTLPMetrics(data: any) {
  const resourceMetrics = data.resourceMetrics || [];

  for (const rm of resourceMetrics) {
    const resourceAttrs = extractAttributes(rm.resource?.attributes || []);
    const scopeMetrics = rm.scopeMetrics || [];

    for (const sm of scopeMetrics) {
      const metrics = sm.metrics || [];

      for (const metric of metrics) {
        const metricName = metric.name;

        // Handle different metric types
        if (metric.sum) {
          // Counter or UpDownCounter
          const dataPoints = metric.sum.dataPoints || [];
          for (const dp of dataPoints) {
            const attrs = extractAttributes(dp.attributes || []);
            const value = dp.asInt || dp.asDouble || 0;

            // Extract session info for Claude Code metrics
            const sessionId = attrs['session.id'] || attrs.session_id || resourceAttrs['session.id'] || resourceAttrs.session_id;
            const userId = attrs['user.id'] || attrs.user_id || resourceAttrs['user.id'] || resourceAttrs.user_id;
            const userEmail = attrs['user.email'] || resourceAttrs['user.email'];
            const orgId = attrs['organization.id'] || resourceAttrs['organization.id'];
            const model = attrs.model || resourceAttrs.model;

            // Create/update session if we have session data
            if (sessionId && metricName === 'claude_code.cost.usage') {
              upsertSession.run(sessionId, userId, userEmail, orgId, model);
              updateSessionCost.run(value, 0, 0, 0, 0, sessionId);
            } else if (sessionId && metricName === 'claude_code.token.usage') {
              const tokenType = attrs.type;
              const inputTokens = tokenType === 'input' ? value : 0;
              const outputTokens = tokenType === 'output' ? value : 0;
              const cacheReadTokens = tokenType === 'cacheRead' ? value : 0;
              const cacheCreationTokens = tokenType === 'cacheCreation' ? value : 0;
              
              updateSessionCost.run(0, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, sessionId);
            } else if (sessionId && metricName === 'conversation.message.cost') {
              // Handle message cost metric
              const messageId = attrs.message_id || attrs['message.id'];
              const conversationId = attrs.conversation_id || attrs['conversation.id'];
              const role = attrs.role || attrs['message.role'];
              const model = attrs.model || attrs['message.model'];
              const cost = value;
              
              if (messageId) {
                // Try to insert the message (will be updated with tokens later)
                try {
                  insertMessage.run(
                    messageId,
                    sessionId,
                    conversationId || null,
                    role || null,
                    model || null,
                    cost,
                    0, // input_tokens - will be updated
                    0, // output_tokens - will be updated
                    0, // cache_creation_tokens - will be updated
                    0  // cache_read_tokens - will be updated
                  );
                } catch (e) {
                  // Message might already exist, that's ok
                }
              }
            } else if (metricName === 'conversation.message.tokens') {
              // Handle message token metric
              const messageId = attrs.message_id || attrs['message.id'];
              const tokenType = attrs.type || attrs['token.type'];
              
              if (messageId && tokenType) {
                const inputTokens = tokenType === 'input' ? value : 0;
                const outputTokens = tokenType === 'output' ? value : 0;
                const cacheReadTokens = tokenType === 'cache_read' ? value : 0;
                const cacheCreationTokens = tokenType === 'cache_creation' ? value : 0;
                
                // Update message tokens
                updateMessageTokens.run(inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, messageId);
              }
            }

            insertMetric.run(
              metric.sum.isMonotonic ? "counter" : "gauge",
              metricName,
              value,
              JSON.stringify({ ...resourceAttrs, ...attrs }),
              attrs.project_path || resourceAttrs.project_path || null,
              userId || attrs.user_account_uuid || resourceAttrs.user_account_uuid || null,
              sessionId || resourceAttrs.session_id || null,
              JSON.stringify({
                timestamp: dp.timeUnixNano,
                service: resourceAttrs['service.name'] || "claude-code",
              })
            );
          }
        } else if (metric.gauge) {
          // Gauge
          const dataPoints = metric.gauge.dataPoints || [];
          for (const dp of dataPoints) {
            const attrs = extractAttributes(dp.attributes || []);
            const value = dp.asInt || dp.asDouble || 0;

            insertMetric.run(
              "gauge",
              metricName,
              value,
              JSON.stringify({ ...resourceAttrs, ...attrs }),
              attrs.project_path || resourceAttrs.project_path || null,
              attrs.user_account_uuid ||
                resourceAttrs.user_account_uuid ||
                null,
              attrs.session_id || resourceAttrs.session_id || null,
              JSON.stringify({
                timestamp: dp.timeUnixNano,
                service: resourceAttrs['service.name'] || "claude-code",
              })
            );
          }
        } else if (metric.histogram) {
          // Histogram
          const dataPoints = metric.histogram.dataPoints || [];
          for (const dp of dataPoints) {
            const attrs = extractAttributes(dp.attributes || []);

            // Store histogram summary statistics
            insertMetric.run(
              "histogram",
              metricName,
              dp.sum || 0,
              JSON.stringify({
                ...resourceAttrs,
                ...attrs,
                count: dp.count,
                min: dp.min,
                max: dp.max,
              }),
              attrs.project_path || resourceAttrs.project_path || null,
              attrs.user_account_uuid ||
                resourceAttrs.user_account_uuid ||
                null,
              attrs.session_id || resourceAttrs.session_id || null,
              JSON.stringify({
                timestamp: dp.timeUnixNano,
                service: resourceAttrs['service.name'] || "claude-code",
                buckets: dp.bucketCounts,
                exemplars: dp.exemplars,
              })
            );
          }
        }
      }
    }
  }
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Service",
};

// Logging helper function - only log data ingestion endpoints
function logRequest(
  req: Request,
  endpoint: string,
  responseStatus: number,
  responseTime: number,
  errorMessage?: string,
  requestBody?: string
) {
  // Only log POST requests that are recording data (metrics, events, OTLP)
  const isDataIngestion =
    req.method === "POST" &&
    (endpoint === "/metrics" ||
      endpoint === "/events" ||
      endpoint === "/v1/metrics");

  if (!isDataIngestion) {
    return; // Skip logging for UI/read operations
  }

  const url = new URL(req.url);
  const ip =
    req.headers.get("x-forwarded-for") ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const userAgent = req.headers.get("user-agent") || "unknown";

  try {
    insertLog.run(
      endpoint,
      req.method,
      ip,
      userAgent,
      requestBody || null,
      responseStatus,
      responseTime,
      errorMessage || null
    );
    console.log(
      `[${new Date().toISOString()}] DATA RECEIVED: ${
        req.method
      } ${endpoint} - ${responseStatus} (${responseTime}ms)`
    );
  } catch (error) {
    console.error("Failed to log request:", error);
  }
}

const server = serve({
  routes: {
    // POST /metrics - Record a metric
    "/metrics": {
      async POST(req) {
        const startTime = Date.now();
        let requestBody: string | undefined;

        try {
          const data = await req.json();
          requestBody = JSON.stringify(data);

          insertMetric.run(
            data.metric_type || "counter",
            data.metric_name,
            data.metric_value || 1,
            JSON.stringify(data.labels || {}),
            data.project_path || null,
            data.user_id || null,
            data.session_id || null,
            JSON.stringify(data.metadata || {})
          );

          const responseTime = Date.now() - startTime;
          logRequest(
            req,
            "/metrics",
            200,
            responseTime,
            undefined,
            requestBody
          );

          return Response.json(
            { success: true, message: "Metric recorded" },
            { headers: corsHeaders }
          );
        } catch (error) {
          const responseTime = Date.now() - startTime;
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logRequest(
            req,
            "/metrics",
            500,
            responseTime,
            errorMessage,
            requestBody
          );

          return Response.json(
            { error: "Failed to record metric", message: errorMessage },
            { headers: corsHeaders, status: 500 }
          );
        }
      },
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
    },

    // POST /events - Record an event
    "/events": {
      async POST(req) {
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
      },
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

    // POST /v1/metrics - OTLP endpoint
    "/v1/metrics": {
      async POST(req) {
        const startTime = Date.now();
        let requestBody: string | undefined;

        try {
          const contentType = req.headers.get("content-type") || "";
          let data;

          if (contentType.includes("application/x-protobuf")) {
            // Handle protobuf format (simplified - in production you'd use proper protobuf decoding)
            const responseTime = Date.now() - startTime;
            logRequest(
              req,
              "/v1/metrics",
              400,
              responseTime,
              "Protobuf format not supported"
            );

            return Response.json(
              {
                error:
                  "Protobuf format not yet supported. Please use JSON format by setting OTEL_EXPORTER_OTLP_PROTOCOL=http/json",
              },
              { headers: corsHeaders, status: 400 }
            );
          } else {
            // Handle JSON format
            data = await req.json();
            requestBody = JSON.stringify(data);
          }

          // Process OTLP metrics
          processOTLPMetrics(data);

          const responseTime = Date.now() - startTime;
          logRequest(
            req,
            "/v1/metrics",
            200,
            responseTime,
            undefined,
            requestBody
          );

          // OTLP expects an empty response on success
          return new Response(null, { status: 200, headers: corsHeaders });
        } catch (error) {
          const responseTime = Date.now() - startTime;
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";
          logRequest(
            req,
            "/v1/metrics",
            500,
            responseTime,
            errorMessage,
            requestBody
          );

          return Response.json(
            { error: "Failed to process OTLP metrics", message: errorMessage },
            { headers: corsHeaders, status: 500 }
          );
        }
      },
    },

    // GET /health - Health check
    "/health": {
      async GET(req) {
        const response = {
          status: "ok",
          service: "claude-metrics-server",
          timestamp: new Date().toISOString(),
          endpoints: {
            metrics: "/metrics",
            events: "/events",
            stats: "/stats",
            otlp: "/v1/metrics",
          },
        };

        return Response.json(response, { headers: corsHeaders });
      },
    },

    // GET /sessions - Get session data
    "/sessions": {
      async GET(req) {
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
      },
    },

    // GET /session/:id - Get individual session details
    "/session/:id": {
      async GET(req, params) {
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

        return Response.json(
          {
            session,
            messages,
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

    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Unified server running at ${server.url}

Available endpoints:
  API:
    POST /metrics     - Record a metric
    POST /events      - Record an event
    GET  /metrics     - Query metrics (params: limit, offset)
    GET  /events      - Query events (params: limit, offset)
    GET  /stats       - Get summary statistics
    GET  /sessions    - Query sessions (params: limit, offset)
    GET  /session/:id - Get individual session details
    GET  /logs        - Query request logs (params: limit, offset)
    POST /v1/metrics  - Receive OTLP metrics
    GET  /health      - Health check
    
  Frontend:
    /  - React application
`);
