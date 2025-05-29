import { insertLog } from "./database";

// CORS headers
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Service",
};

// Helper function to extract attributes from OTLP data
export function extractAttributes(attributes: any[]): Record<string, any> {
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

// Logging helper function - only log data ingestion endpoints
export function logRequest(
  req: Request,
  endpoint: string,
  responseStatus: number,
  responseTime: number,
  errorMessage?: string,
  requestBody?: string,
  extractedData?: any
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
      errorMessage || null,
      extractedData ? JSON.stringify(extractedData) : null
    );
    console.log(
      `[${new Date().toISOString()}] DATA RECEIVED: ${
        req.method
      } ${endpoint} - ${responseStatus} (${responseTime}ms)`
    );
  } catch (err) {
    console.error("Failed to log request:", err);
  }
}
