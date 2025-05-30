import { corsHeaders } from "../lib/utils";
import { getEvents } from "../lib/services/events-service";

export async function handleGetEvents(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const events = getEvents({ limit, offset });

  return Response.json({ events }, { headers: corsHeaders });
}