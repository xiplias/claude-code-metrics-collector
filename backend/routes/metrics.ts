import { db, insertMetric } from "../lib/database";
import { corsHeaders, logRequest } from "../lib/utils";
import { processOTLPMetrics } from "../lib/otlp";

export async function handlePostMetrics(req: Request) {
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
}

export async function handleGetMetrics(req: Request) {
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
}

export async function handlePostV1Metrics(req: Request) {
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
}