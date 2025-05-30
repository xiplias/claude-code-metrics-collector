import { corsHeaders, logRequest } from "../lib/utils";
import { getMetrics } from "../lib/services/metrics-service";
import { validateOTLPContentType, parseOTLPData, processOTLPData } from "../lib/services/otlp-service";
import { extractOTLPData } from "../lib/otlp-helpers";

export async function handleGetMetrics(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const metrics = getMetrics({ limit, offset });

  return Response.json({ metrics }, { headers: corsHeaders });
}

export async function handlePostV1Metrics(req: Request) {
  const startTime = Date.now();
  let requestBody: string | undefined;

  try {
    const contentType = req.headers.get("content-type") || "";
    
    const contentValidation = validateOTLPContentType(contentType);
    if (!contentValidation.isValid) {
      const responseTime = Date.now() - startTime;
      logRequest(req, "/v1/metrics", 400, responseTime, contentValidation.error);
      
      return Response.json(
        { error: contentValidation.error },
        { headers: corsHeaders, status: 400 }
      );
    }

    const data = await parseOTLPData(req);
    requestBody = JSON.stringify(data);

    // Extract key data from OTLP metrics
    const extractedData = extractOTLPData(data);

    const processingResult = processOTLPData(data);
    if (!processingResult.success) {
      const responseTime = Date.now() - startTime;
      logRequest(req, "/v1/metrics", 500, responseTime, processingResult.error, requestBody, extractedData);
      
      return Response.json(
        { error: "Failed to process OTLP metrics", message: processingResult.error },
        { headers: corsHeaders, status: 500 }
      );
    }

    const responseTime = Date.now() - startTime;
    logRequest(req, "/v1/metrics", 200, responseTime, undefined, requestBody, extractedData);

    // OTLP expects an empty response on success
    return new Response(null, { status: 200, headers: corsHeaders });
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logRequest(req, "/v1/metrics", 500, responseTime, errorMessage, requestBody);

    return Response.json(
      { error: "Failed to process OTLP metrics", message: errorMessage },
      { headers: corsHeaders, status: 500 }
    );
  }
}