import { db, insertMetric } from "../database";
import { corsHeaders, logRequest } from "../utils";
import { processOTLPMetrics } from "../otlp";

export const metricsRoutes = {
  // POST /metrics - Record a metric
  "/metrics": {
    async POST(req: Request) {
      const startTime = Date.now();
      let requestBody: string | undefined;

      try {
        const body = await req.json();
        requestBody = JSON.stringify(body);

        insertMetric.run(
          body.metric_type || "gauge",
          body.metric_name,
          body.metric_value || 0,
          JSON.stringify(body.labels || {}),
          body.project_path || null,
          body.user_id || null,
          body.session_id || null,
          JSON.stringify(body.metadata || {})
        );

        const responseTime = Date.now() - startTime;
        logRequest(req, "/metrics", 200, responseTime, undefined, requestBody);

        return Response.json({ success: true }, { headers: corsHeaders });
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/metrics", 500, responseTime, errorMessage, requestBody);

        return Response.json(
          { error: "Failed to record metric", message: errorMessage },
          { headers: corsHeaders, status: 500 }
        );
      }
    },

    // GET /metrics - Query metrics
    async GET(req: Request) {
      const startTime = Date.now();

      try {
        const url = new URL(req.url);
        const limit = parseInt(url.searchParams.get("limit") || "100");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const query = `
          SELECT * FROM metrics
          ORDER BY timestamp DESC
          LIMIT ? OFFSET ?
        `;

        const metrics = db.query(query).all(limit, offset);

        const responseTime = Date.now() - startTime;
        logRequest(req, "/metrics", 200, responseTime);

        return Response.json(metrics, { headers: corsHeaders });
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        logRequest(req, "/metrics", 500, responseTime, errorMessage);

        return Response.json(
          { error: "Failed to query metrics", message: errorMessage },
          { headers: corsHeaders, status: 500 }
        );
      }
    },
  },

  // POST /v1/metrics - OTLP endpoint
  "/v1/metrics": {
    async POST(req: Request) {
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
};