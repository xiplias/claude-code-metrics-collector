import { serve, file } from "bun";
import { join } from "path";

// Import route handlers from backend
import {
  handleGetMetrics,
  handlePostV1Metrics,
} from "./routes/metrics";
import { handleGetEvents } from "./routes/events";
import { handleGetStats } from "./routes/stats";
import { handleGetHealth } from "./routes/health";
import {
  handleGetSessions,
  handleGetSessionById,
  handleGetSessionMessages,
} from "./routes/sessions";
import { handleGetLogs } from "./routes/logs";

const server = serve({
  port: 3000,
  routes: {
    // Telemetry endpoints (root level for external services)

    // POST /v1/metrics - OTLP endpoint
    "/v1/metrics": {
      async POST(req) {
        return handlePostV1Metrics(req);
      },
    },

    // API endpoints (under /api for frontend)
    // GET /api/metrics - Query metrics
    "/api/metrics": {
      async GET(req) {
        return handleGetMetrics(req);
      },
    },

    // GET /api/events - Query events
    "/api/events": {
      async GET(req) {
        return handleGetEvents(req);
      },
    },

    // GET /api/stats - Get summary statistics
    "/api/stats": {
      async GET(req) {
        return handleGetStats(req);
      },
    },

    // GET /api/health - Health check
    "/api/health": {
      async GET(req) {
        return handleGetHealth(req);
      },
    },

    // GET /api/sessions - Get session data
    "/api/sessions": {
      async GET(req) {
        return handleGetSessions(req);
      },
    },

    // GET /api/sessions/:id - Get individual session details
    "/api/sessions/:id": {
      async GET(req) {
        return handleGetSessionById(req);
      },
    },

    // GET /api/sessions/:id/messages - Get paginated session messages
    "/api/sessions/:id/messages": {
      async GET(req) {
        return handleGetSessionMessages(req);
      },
    },

    // GET /api/logs - Get request logs
    "/api/logs": {
      async GET(req) {
        return handleGetLogs(req);
      },
    },

    "/*": {
      async GET(req) {
        const url = new URL(req.url);
        const pathname = url.pathname;
        
        // In production, serve from dist directory
        const distPath = join(process.cwd(), "dist");
        
        // Try to serve static files first
        if (pathname !== "/" && pathname !== "/index.html") {
          const filePath = join(distPath, pathname);
          const staticFile = file(filePath);
          
          if (await staticFile.exists()) {
            return new Response(staticFile);
          }
        }
        
        // Serve index.html for all other routes (SPA)
        const indexPath = join(distPath, "index.html");
        return new Response(file(indexPath));
      }
    },
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
  Telemetry (for external services):
    POST /v1/metrics  - Receive OTLP metrics
    
  API (for frontend):
    GET  /api/metrics     - Query metrics (params: limit, offset)
    GET  /api/events      - Query events (params: limit, offset)
    GET  /api/stats       - Get summary statistics
    GET  /api/sessions    - Query sessions (params: limit, offset)
    GET  /api/sessions/:id - Get individual session details
    GET  /api/logs        - Query request logs (params: limit, offset)
    GET  /api/health      - Health check
    
  Frontend:
    /  - React application
`);
