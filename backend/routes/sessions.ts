import { corsHeaders } from "../lib/utils";
import { getSessions, getSessionDetails } from "../lib/services/sessions-service";

export async function handleGetSessions(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const sessions = getSessions({ limit, offset });

  return Response.json({ sessions }, { headers: corsHeaders });
}

export async function handleGetSessionById(req: Request, params: { id: string }) {
  const sessionId = params.id;
  const sessionDetails = getSessionDetails(sessionId);

  if (!sessionDetails) {
    return Response.json(
      { error: "Session not found" },
      { headers: corsHeaders, status: 404 }
    );
  }

  return Response.json(sessionDetails, { headers: corsHeaders });
}