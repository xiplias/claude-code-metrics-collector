import { describe, test, expect, beforeEach } from "bun:test";
import { createTestDatabase } from "../../../backend/lib/database-test";

describe("Database Operations", () => {
  let testDb: ReturnType<typeof createTestDatabase>;

  beforeEach(() => {
    testDb = createTestDatabase();
  });

  describe("Session Management", () => {
    test("should insert a new session", () => {
      const { upsertSession, db } = testDb;
      
      upsertSession.run("session-123", "user-456", "test@example.com", "org-789", "claude-3-sonnet");

      const session = db.query("SELECT * FROM sessions WHERE session_id = ?").get("session-123");
      
      expect(session).toBeTruthy();
      expect(session.session_id).toBe("session-123");
      expect(session.user_id).toBe("user-456");
      expect(session.user_email).toBe("test@example.com");
      expect(session.organization_id).toBe("org-789");
      expect(session.model).toBe("claude-3-sonnet");
    });

    test("should update session cost and tokens", () => {
      const { upsertSession, updateSessionCost, db } = testDb;
      
      // Insert session first
      upsertSession.run("session-123", "user-456", "test@example.com", "org-789", "claude-3-sonnet");
      
      // Update costs and tokens
      updateSessionCost.run(0.25, 150, 75, 50, 25, "session-123");

      const session = db.query("SELECT * FROM sessions WHERE session_id = ?").get("session-123");
      
      expect(session.total_cost).toBe(0.25);
      expect(session.total_input_tokens).toBe(150);
      expect(session.total_output_tokens).toBe(75);
      expect(session.total_cache_read_tokens).toBe(50);
      expect(session.total_cache_creation_tokens).toBe(25);
    });

    test("should accumulate costs and tokens across multiple updates", () => {
      const { upsertSession, updateSessionCost, db } = testDb;
      
      upsertSession.run("session-123", "user-456", "test@example.com", "org-789", "claude-3-sonnet");
      
      // First update
      updateSessionCost.run(0.15, 100, 50, 30, 20, "session-123");
      // Second update
      updateSessionCost.run(0.10, 50, 25, 20, 10, "session-123");

      const session = db.query("SELECT * FROM sessions WHERE session_id = ?").get("session-123");
      
      expect(session.total_cost).toBe(0.25);
      expect(session.total_input_tokens).toBe(150);
      expect(session.total_output_tokens).toBe(75);
      expect(session.total_cache_read_tokens).toBe(50);
      expect(session.total_cache_creation_tokens).toBe(30);
    });
  });

  describe("Message Management", () => {
    test("should insert a new message", () => {
      const { upsertSession, insertMessage, db } = testDb;
      
      // Insert session first
      upsertSession.run("session-123", "user-456", "test@example.com", "org-789", "claude-3-sonnet");
      
      // Insert message
      insertMessage.run("msg-123", "session-123", "conv-456", "user", "claude-3-sonnet", 0.15, 100, 50, 20, 30);

      const message = db.query("SELECT * FROM messages WHERE message_id = ?").get("msg-123");
      
      expect(message).toBeTruthy();
      expect(message.message_id).toBe("msg-123");
      expect(message.session_id).toBe("session-123");
      expect(message.conversation_id).toBe("conv-456");
      expect(message.role).toBe("user");
      expect(message.model).toBe("claude-3-sonnet");
      expect(message.cost).toBe(0.15);
      expect(message.input_tokens).toBe(100);
      expect(message.output_tokens).toBe(50);
      expect(message.cache_creation_tokens).toBe(20);
      expect(message.cache_read_tokens).toBe(30);
    });

    test("should update message tokens", () => {
      const { upsertSession, insertMessage, updateMessageTokens, db } = testDb;
      
      upsertSession.run("session-123", "user-456", "test@example.com", "org-789", "claude-3-sonnet");
      insertMessage.run("msg-123", "session-123", "conv-456", "user", "claude-3-sonnet", 0.15, 0, 0, 0, 0);
      
      // Update tokens
      updateMessageTokens.run(100, 50, 30, 20, "msg-123");

      const message = db.query("SELECT * FROM messages WHERE message_id = ?").get("msg-123");
      
      expect(message.input_tokens).toBe(100);
      expect(message.output_tokens).toBe(50);
      expect(message.cache_read_tokens).toBe(30);
      expect(message.cache_creation_tokens).toBe(20);
    });

    test("should accumulate tokens across multiple updates", () => {
      const { upsertSession, insertMessage, updateMessageTokens, db } = testDb;
      
      upsertSession.run("session-123", "user-456", "test@example.com", "org-789", "claude-3-sonnet");
      insertMessage.run("msg-123", "session-123", "conv-456", "user", "claude-3-sonnet", 0.15, 0, 0, 0, 0);
      
      // First update
      updateMessageTokens.run(50, 25, 15, 10, "msg-123");
      // Second update
      updateMessageTokens.run(50, 25, 15, 10, "msg-123");

      const message = db.query("SELECT * FROM messages WHERE message_id = ?").get("msg-123");
      
      expect(message.input_tokens).toBe(100);
      expect(message.output_tokens).toBe(50);
      expect(message.cache_read_tokens).toBe(30);
      expect(message.cache_creation_tokens).toBe(20);
    });
  });

  describe("Metrics Storage", () => {
    test("should insert metrics", () => {
      const { insertMetric, db } = testDb;
      
      insertMetric.run(
        "counter",
        "claude_code.cost.usage",
        0.25,
        '{"session_id": "session-123"}',
        "/project/path",
        "user-456",
        "session-123",
        '{"timestamp": "2024-01-01T00:00:00Z"}'
      );

      const metric = db.query("SELECT * FROM metrics WHERE metric_name = ?").get("claude_code.cost.usage");
      
      expect(metric).toBeTruthy();
      expect(metric.metric_type).toBe("counter");
      expect(metric.metric_name).toBe("claude_code.cost.usage");
      expect(metric.metric_value).toBe(0.25);
      expect(metric.labels).toBe('{"session_id": "session-123"}');
      expect(metric.project_path).toBe("/project/path");
      expect(metric.user_id).toBe("user-456");
      expect(metric.session_id).toBe("session-123");
      expect(metric.metadata).toBe('{"timestamp": "2024-01-01T00:00:00Z"}');
    });
  });

  describe("Events Storage", () => {
    test("should insert events", () => {
      const { insertEvent, db } = testDb;
      
      insertEvent.run(
        "command",
        "file.read",
        "/project/path",
        "user-456",
        "session-123",
        150,
        '{"file_path": "/test/file.txt"}'
      );

      const event = db.query("SELECT * FROM events WHERE event_name = ?").get("file.read");
      
      expect(event).toBeTruthy();
      expect(event.event_type).toBe("command");
      expect(event.event_name).toBe("file.read");
      expect(event.project_path).toBe("/project/path");
      expect(event.user_id).toBe("user-456");
      expect(event.session_id).toBe("session-123");
      expect(event.duration_ms).toBe(150);
      expect(event.metadata).toBe('{"file_path": "/test/file.txt"}');
    });
  });
});