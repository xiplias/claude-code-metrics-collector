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

// Prepare statements for better performance
const insertMetric = db.prepare(`
  INSERT INTO metrics (metric_type, metric_name, metric_value, labels, project_path, user_id, session_id, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertEvent = db.prepare(`
  INSERT INTO events (event_type, event_name, project_path, user_id, session_id, duration_ms, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

// Helper function to extract attributes from OTLP data
function extractAttributes(attributes: any[]): Record<string, any> {
  const result: Record<string, any> = {};
  if (!attributes) return result;
  
  for (const attr of attributes) {
    const key = attr.key;
    const value = attr.value?.stringValue || attr.value?.intValue || attr.value?.doubleValue || attr.value?.boolValue;
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
            
            insertMetric.run(
              metric.sum.isMonotonic ? "counter" : "gauge",
              metricName,
              value,
              JSON.stringify({ ...resourceAttrs, ...attrs }),
              attrs.project_path || resourceAttrs.project_path || null,
              attrs.user_account_uuid || resourceAttrs.user_account_uuid || null,
              attrs.session_id || resourceAttrs.session_id || null,
              JSON.stringify({
                timestamp: dp.timeUnixNano,
                service: resourceAttrs.service?.name || "claude-code"
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
              attrs.user_account_uuid || resourceAttrs.user_account_uuid || null,
              attrs.session_id || resourceAttrs.session_id || null,
              JSON.stringify({
                timestamp: dp.timeUnixNano,
                service: resourceAttrs.service?.name || "claude-code"
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
                max: dp.max
              }),
              attrs.project_path || resourceAttrs.project_path || null,
              attrs.user_account_uuid || resourceAttrs.user_account_uuid || null,
              attrs.session_id || resourceAttrs.session_id || null,
              JSON.stringify({
                timestamp: dp.timeUnixNano,
                service: resourceAttrs.service?.name || "claude-code",
                buckets: dp.bucketCounts,
                exemplars: dp.exemplars
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

const server = serve({
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,

    // POST /api/metrics - Record a metric
    "/api/metrics": {
      async POST(req) {
        const data = await req.json();
        
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

        return Response.json(
          { success: true, message: "Metric recorded" },
          { headers: corsHeaders }
        );
      },
      async GET(req) {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        
        const metrics = db.query(`
          SELECT * FROM metrics 
          ORDER BY timestamp DESC 
          LIMIT ? OFFSET ?
        `).all(limit, offset);

        return Response.json(
          { metrics },
          { headers: corsHeaders }
        );
      }
    },

    // POST /api/events - Record an event
    "/api/events": {
      async POST(req) {
        const data = await req.json();
        
        insertEvent.run(
          data.event_type,
          data.event_name,
          data.project_path || null,
          data.user_id || null,
          data.session_id || null,
          data.duration_ms || null,
          JSON.stringify(data.metadata || {})
        );

        return Response.json(
          { success: true, message: "Event recorded" },
          { headers: corsHeaders }
        );
      },
      async GET(req) {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");
        
        const events = db.query(`
          SELECT * FROM events 
          ORDER BY timestamp DESC 
          LIMIT ? OFFSET ?
        `).all(limit, offset);

        return Response.json(
          { events },
          { headers: corsHeaders }
        );
      }
    },

    // GET /api/stats - Get summary statistics
    "/api/stats": {
      async GET(req) {
        const metricStats = db.query(`
          SELECT 
            metric_name,
            COUNT(*) as count,
            SUM(metric_value) as total,
            AVG(metric_value) as average,
            MIN(metric_value) as min,
            MAX(metric_value) as max
          FROM metrics
          GROUP BY metric_name
        `).all();

        const eventStats = db.query(`
          SELECT 
            event_type,
            event_name,
            COUNT(*) as count,
            AVG(duration_ms) as avg_duration_ms
          FROM events
          GROUP BY event_type, event_name
        `).all();

        return Response.json(
          { 
            metrics: metricStats,
            events: eventStats
          },
          { headers: corsHeaders }
        );
      }
    },

    // POST /api/v1/metrics - OTLP endpoint
    "/api/v1/metrics": {
      async POST(req) {
        const contentType = req.headers.get("content-type") || "";
        let data;
        
        if (contentType.includes("application/x-protobuf")) {
          // Handle protobuf format (simplified - in production you'd use proper protobuf decoding)
          return Response.json(
            { 
              error: "Protobuf format not yet supported. Please use JSON format by setting OTEL_EXPORTER_OTLP_PROTOCOL=http/json" 
            },
            { headers: corsHeaders, status: 400 }
          );
        } else {
          // Handle JSON format
          data = await req.json();
        }
        
        // Process OTLP metrics
        processOTLPMetrics(data);
        
        // OTLP expects an empty response on success
        return new Response(null, { status: 200, headers: corsHeaders });
      }
    },

    // GET /api/health - Health check
    "/api/health": {
      async GET(req) {
        return Response.json(
          { 
            status: "ok",
            service: "claude-metrics-server",
            timestamp: new Date().toISOString(),
            endpoints: {
              metrics: "/api/metrics",
              events: "/api/events",
              stats: "/api/stats",
              otlp: "/api/v1/metrics"
            }
          },
          { headers: corsHeaders }
        );
      }
    },

    // Handle CORS preflight for all routes
    "/api/*": {
      async OPTIONS(req) {
        return new Response(null, { headers: corsHeaders, status: 204 });
      }
    }
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
    POST /api/metrics    - Record a metric
    POST /api/events     - Record an event
    GET  /api/metrics    - Query metrics (params: limit, offset)
    GET  /api/events     - Query events (params: limit, offset)
    GET  /api/stats      - Get summary statistics
    POST /api/v1/metrics - Receive OTLP metrics
    GET  /api/health     - Health check
    
  Frontend:
    /  - React application
`);
