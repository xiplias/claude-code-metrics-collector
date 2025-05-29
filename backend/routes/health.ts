import { corsHeaders } from "../lib/utils";

export async function handleGetHealth(req: Request) {
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
}