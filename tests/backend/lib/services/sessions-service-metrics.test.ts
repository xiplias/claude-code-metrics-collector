import { describe, it, expect, beforeEach } from "bun:test";
import { getSessionDetails } from "../../../../backend/lib/services/sessions-service-test";
import { testDb, testInsertMetric, testUpsertSession, testInsertMessage } from "../../../../backend/lib/test-database";

describe("Sessions Service - Message Metrics Enhancement", () => {
  beforeEach(() => {
    // Clean up test data
    testDb.exec("DELETE FROM sessions WHERE session_id LIKE 'test-metrics-%'");
    testDb.exec("DELETE FROM messages WHERE session_id LIKE 'test-metrics-%'");
    testDb.exec("DELETE FROM metrics WHERE session_id LIKE 'test-metrics-%'");
  });

  it("should enhance messages with their associated metric types", () => {
    const sessionId = "test-metrics-session-001";
    const messageId1 = "test-metrics-msg-001";
    const messageId2 = "test-metrics-msg-002";

    // Create test session
    testUpsertSession.run(sessionId, "test-user", "test@example.com", "test-org", "claude-3-sonnet");

    // Create test messages
    testInsertMessage.run(messageId1, sessionId, "conv-001", "user", "claude-3-sonnet", 0.02, 100, 0, 0, 0);
    testInsertMessage.run(messageId2, sessionId, "conv-001", "assistant", "claude-3-sonnet", 0.08, 800, 400, 50, 1000);

    // Create metrics for message 1
    testInsertMetric.run(
      "counter",
      "conversation.message.cost",
      0.02,
      JSON.stringify({ message_id: messageId1, role: "user" }),
      null,
      "test-user",
      sessionId,
      "{}"
    );
    testInsertMetric.run(
      "counter",
      "conversation.message.tokens",
      100,
      JSON.stringify({ message_id: messageId1, type: "input" }),
      null,
      "test-user",
      sessionId,
      "{}"
    );

    // Create metrics for message 2
    testInsertMetric.run(
      "counter",
      "conversation.message.cost",
      0.08,
      JSON.stringify({ "message.id": messageId2, role: "assistant" }),
      null,
      "test-user",
      sessionId,
      "{}"
    );
    testInsertMetric.run(
      "counter",
      "conversation.message.tokens",
      800,
      JSON.stringify({ message_id: messageId2, type: "input" }),
      null,
      "test-user",
      sessionId,
      "{}"
    );
    testInsertMetric.run(
      "counter",
      "conversation.message.tokens",
      400,
      JSON.stringify({ message_id: messageId2, type: "output" }),
      null,
      "test-user",
      sessionId,
      "{}"
    );
    testInsertMetric.run(
      "counter",
      "claude_code.cost.usage",
      0.10,
      JSON.stringify({ session_id: sessionId }),
      null,
      "test-user",
      sessionId,
      "{}"
    );

    // Get session details
    const details = getSessionDetails(sessionId);
    
    expect(details).toBeTruthy();
    expect(details!.messages).toHaveLength(2);

    // Check first message has its metric types
    const msg1 = details!.messages.find(m => m.message_id === messageId1);
    expect(msg1).toBeTruthy();
    expect(msg1.metric_types).toContain("conversation.message.cost");
    expect(msg1.metric_types).toContain("conversation.message.tokens");
    expect(msg1.metric_types).not.toContain("claude_code.cost.usage");

    // Check second message has its metric types
    const msg2 = details!.messages.find(m => m.message_id === messageId2);
    expect(msg2).toBeTruthy();
    expect(msg2.metric_types).toContain("conversation.message.cost");
    expect(msg2.metric_types).toContain("conversation.message.tokens");
    expect(msg2.metric_types).not.toContain("claude_code.cost.usage");
  });

  it("should handle messages without metrics", () => {
    const sessionId = "test-metrics-session-002";
    const messageId = "test-metrics-msg-003";

    // Create test session and message
    testUpsertSession.run(sessionId, "test-user", "test@example.com", "test-org", "claude-3-sonnet");
    testInsertMessage.run(messageId, sessionId, "conv-002", "user", "claude-3-sonnet", 0.01, 50, 0, 0, 0);

    // Create a session-level metric (not associated with the message)
    testInsertMetric.run(
      "counter",
      "claude_code.cost.usage",
      0.01,
      JSON.stringify({ session_id: sessionId }),
      null,
      "test-user",
      sessionId,
      "{}"
    );

    // Get session details
    const details = getSessionDetails(sessionId);
    
    expect(details).toBeTruthy();
    expect(details!.messages).toHaveLength(1);

    const msg = details!.messages[0];
    expect(msg.metric_types).toHaveLength(0);
  });

  it("should handle alternative message_id attribute names", () => {
    const sessionId = "test-metrics-session-003";
    const messageId = "test-metrics-msg-004";

    // Create test session and message
    testUpsertSession.run(sessionId, "test-user", "test@example.com", "test-org", "claude-3-sonnet");
    testInsertMessage.run(messageId, sessionId, "conv-003", "assistant", "claude-3-sonnet", 0.05, 500, 250, 0, 0);

    // Create metrics with different attribute name formats
    testInsertMetric.run(
      "counter",
      "conversation.message.cost",
      0.05,
      JSON.stringify({ "message.id": messageId }),
      null,
      "test-user",
      sessionId,
      "{}"
    );

    // Get session details
    const details = getSessionDetails(sessionId);
    
    expect(details).toBeTruthy();
    expect(details!.messages).toHaveLength(1);

    const msg = details!.messages[0];
    expect(msg.metric_types).toContain("conversation.message.cost");
  });
});