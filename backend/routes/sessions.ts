import { corsHeaders } from "../lib/utils";
import { 
  getSessions, 
  getSessionDetails, 
  getSessionById,
  getSessionMessages 
} from "../lib/services/sessions-service";

export async function handleGetSessions(req: Request) {
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "100");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const sessions = getSessions({ limit, offset });

  return Response.json(sessions, { headers: corsHeaders });
}

export async function handleGetSessionById(req: Request & { params: { id: string } }) {
  const sessionId = req.params.id;
  const url = new URL(req.url);
  
  // Check if pagination parameters are provided
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");
  
  if (limit || offset) {
    // Return paginated version
    const session = getSessionById(sessionId);
    if (!session) {
      return Response.json(
        { error: "Session not found" },
        { headers: corsHeaders, status: 404 }
      );
    }

    const messageLimit = parseInt(limit || "20");
    const messageOffset = parseInt(offset || "0");
    const messages = getSessionMessages(sessionId, { limit: messageLimit, offset: messageOffset });
    
    return Response.json({
      session,
      messages: {
        messages: messages.messages,
        total: messages.total,
        hasMore: messages.hasMore,
      },
      // For now, return empty arrays for events/metrics in paginated mode
      events: [],
      metrics: [],
    }, { headers: corsHeaders });
  }

  // Return full session details (existing behavior)
  const sessionDetails = getSessionDetails(sessionId);

  if (!sessionDetails) {
    return Response.json(
      { error: "Session not found" },
      { headers: corsHeaders, status: 404 }
    );
  }

  return Response.json(sessionDetails, { headers: corsHeaders });
}

export async function handleGetSessionMessages(req: Request & { params: { id: string } }) {
  const sessionId = req.params.id;
  const url = new URL(req.url);
  const limit = parseInt(url.searchParams.get("limit") || "20");
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const session = getSessionById(sessionId);
  if (!session) {
    return Response.json(
      { error: "Session not found" },
      { headers: corsHeaders, status: 404 }
    );
  }

  const result = getSessionMessages(sessionId, { limit, offset });
  
  return Response.json(result, { headers: corsHeaders });
}