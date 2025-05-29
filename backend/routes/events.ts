import { corsHeaders, logRequest } from "../lib/utils";
import { recordEvent, getEvents, validateEventData, parseEventData } from "../lib/services/events-service";

export async function handlePostEvents(req: Request) {
  const startTime = Date.now();
  let requestBody: string | undefined;

  try {
    const rawData = await req.json();
    requestBody = JSON.stringify(rawData);

    const validation = validateEventData(rawData);
    if (!validation.isValid) {
      const responseTime = Date.now() - startTime;
      logRequest(req, "/events", 400, responseTime, validation.error, requestBody);
      
      return Response.json(
        { error: validation.error },
        { headers: corsHeaders, status: 400 }
      );
    }

    const eventData = parseEventData(rawData);
    recordEvent(eventData);

    const responseTime = Date.now() - startTime;
    logRequest(req, "/events", 200, responseTime, undefined, requestBody);

    return Response.json(
      { success: true, message: "Event recorded" },
      { headers: corsHeaders }
    );
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logRequest(req, "/events", 500, responseTime, errorMessage, requestBody);

    return Response.json(
      { error: "Failed to record event", message: errorMessage },
      { headers: corsHeaders, status: 500 }
    );
  }
}

export async function handleGetEvents(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const events = getEvents({ limit, offset });

  return Response.json({ events }, { headers: corsHeaders });
}