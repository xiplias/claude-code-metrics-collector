import { testUpsertSession, testUpdateSessionCost } from "./test-database";

export interface SessionData {
  sessionId: string | null;
  userId: string | null;
  userEmail: string | null;
  orgId: string | null;
  model: string | null;
}

export interface SessionCosts {
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

// Extract session information from resource and data point attributes
export function extractSessionData(resourceAttrs: Record<string, any>, dpAttrs: Record<string, any> = {}): SessionData {
  return {
    sessionId: resourceAttrs['session_id'] || dpAttrs['session.id'] || null,
    userId: resourceAttrs['user_id'] || dpAttrs['user.id'] || null,
    userEmail: resourceAttrs['user_email'] || dpAttrs['user.email'] || null,
    orgId: resourceAttrs['organization_id'] || dpAttrs['organization.id'] || null,
    model: resourceAttrs['model'] || dpAttrs['model'] || null
  };
}

// Update session data with additional information if not already set
export function updateSessionData(sessionData: SessionData, additionalData: SessionData): SessionData {
  return {
    sessionId: sessionData.sessionId || additionalData.sessionId,
    userId: sessionData.userId || additionalData.userId,
    userEmail: sessionData.userEmail || additionalData.userEmail,
    orgId: sessionData.orgId || additionalData.orgId,
    model: sessionData.model || additionalData.model
  };
}

// Create or update session in database
export function saveSession(sessionData: SessionData): boolean {
  if (!sessionData.sessionId) {
    return false;
  }

  testUpsertSession.run(
    sessionData.sessionId,
    sessionData.userId,
    sessionData.userEmail,
    sessionData.orgId,
    sessionData.model
  );
  
  return true;
}

// Update session costs and token counts
export function updateSession(sessionData: SessionData, costs: SessionCosts): boolean {
  if (!sessionData.sessionId) {
    return false;
  }

  testUpdateSessionCost.run(
    costs.totalCost,
    costs.inputTokens,
    costs.outputTokens,
    costs.cacheReadTokens,
    costs.cacheCreationTokens,
    sessionData.sessionId
  );
  
  return true;
}

// Process complete session (create + update costs)
export function processSession(sessionData: SessionData, costs: SessionCosts): boolean {
  if (!sessionData.sessionId) {
    return false;
  }
  
  const sessionSaved = saveSession(sessionData);
  const sessionUpdated = updateSession(sessionData, costs);
  
  return sessionSaved && sessionUpdated;
}