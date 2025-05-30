import { describe, it, expect, beforeEach } from "bun:test";
import { 
  extractSessionData, 
  updateSessionData, 
  saveSession, 
  updateSession, 
  processSession,
  SessionData,
  SessionCosts 
} from "../../../backend/lib/session-processor-test";
import { testDb } from "../../../backend/lib/test-database";

describe("Session Processor", () => {
  beforeEach(() => {
    // Clean up test data
    testDb.exec("DELETE FROM sessions WHERE session_id LIKE 'test-session-%'");
  });

  describe("extractSessionData", () => {
    it("should extract session data from resource attributes", () => {
      const resourceAttrs = {
        'session_id': 'test-session-001',
        'user_id': 'test-user-001',
        'user_email': 'test@example.com',
        'organization_id': 'test-org-001',
        'model': 'claude-3-sonnet'
      };

      const sessionData = extractSessionData(resourceAttrs);
      
      expect(sessionData.sessionId).toBe('test-session-001');
      expect(sessionData.userId).toBe('test-user-001');
      expect(sessionData.userEmail).toBe('test@example.com');
      expect(sessionData.orgId).toBe('test-org-001');
      expect(sessionData.model).toBe('claude-3-sonnet');
    });

    it("should extract session data from data point attributes", () => {
      const dpAttrs = {
        'session.id': 'test-session-002',
        'user.id': 'test-user-002',
        'user.email': 'test2@example.com',
        'organization.id': 'test-org-002',
        'model': 'claude-3-haiku'
      };

      const sessionData = extractSessionData({}, dpAttrs);
      
      expect(sessionData.sessionId).toBe('test-session-002');
      expect(sessionData.userId).toBe('test-user-002');
      expect(sessionData.userEmail).toBe('test2@example.com');
      expect(sessionData.orgId).toBe('test-org-002');
      expect(sessionData.model).toBe('claude-3-haiku');
    });

    it("should prefer resource attributes over data point attributes", () => {
      const resourceAttrs = {
        'session_id': 'resource-session',
        'user_id': 'resource-user'
      };
      const dpAttrs = {
        'session.id': 'dp-session',
        'user.id': 'dp-user'
      };

      const sessionData = extractSessionData(resourceAttrs, dpAttrs);
      
      expect(sessionData.sessionId).toBe('resource-session');
      expect(sessionData.userId).toBe('resource-user');
    });

    it("should handle missing attributes gracefully", () => {
      const sessionData = extractSessionData({});
      
      expect(sessionData.sessionId).toBeNull();
      expect(sessionData.userId).toBeNull();
      expect(sessionData.userEmail).toBeNull();
      expect(sessionData.orgId).toBeNull();
      expect(sessionData.model).toBeNull();
    });
  });

  describe("updateSessionData", () => {
    it("should update session data with missing fields", () => {
      const existing: SessionData = {
        sessionId: 'test-session-003',
        userId: 'test-user-003',
        userEmail: null,
        orgId: null,
        model: null
      };

      const additional: SessionData = {
        sessionId: null,
        userId: null,
        userEmail: 'test3@example.com',
        orgId: 'test-org-003',
        model: 'claude-3-opus'
      };

      const updated = updateSessionData(existing, additional);
      
      expect(updated.sessionId).toBe('test-session-003');
      expect(updated.userId).toBe('test-user-003');
      expect(updated.userEmail).toBe('test3@example.com');
      expect(updated.orgId).toBe('test-org-003');
      expect(updated.model).toBe('claude-3-opus');
    });

    it("should not overwrite existing values", () => {
      const existing: SessionData = {
        sessionId: 'test-session-004',
        userId: 'existing-user',
        userEmail: 'existing@example.com',
        orgId: 'existing-org',
        model: 'existing-model'
      };

      const additional: SessionData = {
        sessionId: 'new-session',
        userId: 'new-user',
        userEmail: 'new@example.com',
        orgId: 'new-org',
        model: 'new-model'
      };

      const updated = updateSessionData(existing, additional);
      
      expect(updated.sessionId).toBe('test-session-004');
      expect(updated.userId).toBe('existing-user');
      expect(updated.userEmail).toBe('existing@example.com');
      expect(updated.orgId).toBe('existing-org');
      expect(updated.model).toBe('existing-model');
    });
  });

  describe("saveSession", () => {
    it("should save session to database", () => {
      const sessionData: SessionData = {
        sessionId: 'test-session-save-001',
        userId: 'test-user-save-001',
        userEmail: 'save@example.com',
        orgId: 'test-org-save-001',
        model: 'claude-3-sonnet'
      };

      const result = saveSession(sessionData);
      expect(result).toBe(true);

      const savedSession = testDb.query("SELECT * FROM sessions WHERE session_id = ?")
        .get('test-session-save-001');
      expect(savedSession).toBeTruthy();
      expect(savedSession.user_id).toBe('test-user-save-001');
      expect(savedSession.user_email).toBe('save@example.com');
    });

    it("should return false for session without sessionId", () => {
      const sessionData: SessionData = {
        sessionId: null,
        userId: 'test-user',
        userEmail: 'test@example.com',
        orgId: 'test-org',
        model: 'claude-3-sonnet'
      };

      const result = saveSession(sessionData);
      expect(result).toBe(false);
    });

    it("should preserve existing session data on upsert", () => {
      const sessionData: SessionData = {
        sessionId: 'test-session-update-001',
        userId: 'original-user',
        userEmail: 'original@example.com',
        orgId: 'original-org',
        model: 'original-model'
      };

      // Save initially
      saveSession(sessionData);

      // Attempt to update with new data (should preserve original)
      const updatedData: SessionData = {
        sessionId: 'test-session-update-001',
        userId: 'updated-user',
        userEmail: 'updated@example.com',
        orgId: 'updated-org',
        model: 'updated-model'
      };

      const result = saveSession(updatedData);
      expect(result).toBe(true);

      const savedSession = testDb.query("SELECT * FROM sessions WHERE session_id = ?")
        .get('test-session-update-001');
      // Should preserve original data (upsert only updates last_seen)
      expect(savedSession.user_id).toBe('original-user');
      expect(savedSession.user_email).toBe('original@example.com');
    });
  });

  describe("updateSession", () => {
    it("should update session costs", () => {
      // First create a session
      const sessionData: SessionData = {
        sessionId: 'test-session-costs-001',
        userId: 'test-user-costs-001',
        userEmail: 'costs@example.com',
        orgId: 'test-org-costs-001',
        model: 'claude-3-sonnet'
      };
      saveSession(sessionData);

      const costs: SessionCosts = {
        totalCost: 0.15,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 2000,
        cacheCreationTokens: 100
      };

      const result = updateSession(sessionData, costs);
      expect(result).toBe(true);

      const session = testDb.query("SELECT * FROM sessions WHERE session_id = ?")
        .get('test-session-costs-001');
      expect(session.total_cost).toBe(0.15);
      expect(session.total_input_tokens).toBe(1000);
      expect(session.total_output_tokens).toBe(500);
      expect(session.total_cache_read_tokens).toBe(2000);
      expect(session.total_cache_creation_tokens).toBe(100);
    });

    it("should return false for session without sessionId", () => {
      const sessionData: SessionData = {
        sessionId: null,
        userId: 'test-user',
        userEmail: 'test@example.com',
        orgId: 'test-org',
        model: 'claude-3-sonnet'
      };

      const costs: SessionCosts = {
        totalCost: 0.15,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 2000,
        cacheCreationTokens: 100
      };

      const result = updateSession(sessionData, costs);
      expect(result).toBe(false);
    });
  });

  describe("processSession", () => {
    it("should create session and update costs in one operation", () => {
      const sessionData: SessionData = {
        sessionId: 'test-session-process-001',
        userId: 'test-user-process-001',
        userEmail: 'process@example.com',
        orgId: 'test-org-process-001',
        model: 'claude-3-sonnet'
      };

      const costs: SessionCosts = {
        totalCost: 0.25,
        inputTokens: 1500,
        outputTokens: 750,
        cacheReadTokens: 3000,
        cacheCreationTokens: 150
      };

      const result = processSession(sessionData, costs);
      expect(result).toBe(true);

      const session = testDb.query("SELECT * FROM sessions WHERE session_id = ?")
        .get('test-session-process-001');
      expect(session).toBeTruthy();
      expect(session.user_id).toBe('test-user-process-001');
      expect(session.total_cost).toBe(0.25);
      expect(session.total_input_tokens).toBe(1500);
    });

    it("should return false when sessionId is missing", () => {
      const sessionData: SessionData = {
        sessionId: null,
        userId: 'test-user',
        userEmail: 'test@example.com',
        orgId: 'test-org',
        model: 'claude-3-sonnet'
      };

      const costs: SessionCosts = {
        totalCost: 0.15,
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 2000,
        cacheCreationTokens: 100
      };

      const result = processSession(sessionData, costs);
      expect(result).toBe(false);
    });
  });
});