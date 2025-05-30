import { describe, it, expect, beforeEach } from "bun:test";
import { processOTLPMetrics } from "../../../backend/lib/otlp";
import { db } from "../../../backend/lib/database";

describe("Synthetic Message Creation", () => {
  beforeEach(() => {
    // Clear all tables
    db.exec("DELETE FROM sessions");
    db.exec("DELETE FROM messages");
    db.exec("DELETE FROM metrics");
  });

  it("should create synthetic messages for session-level metrics without message_id", () => {
    // This simulates the actual metrics Claude Code CLI sends
    const otlpData = {
      resourceMetrics: [{
        resource: {
          attributes: [
            { key: "session_id", value: { stringValue: "test-session-123" } },
            { key: "user.id", value: { stringValue: "user-456" } },
            { key: "user.email", value: { stringValue: "test@example.com" } },
            { key: "organization.id", value: { stringValue: "org-789" } },
          ]
        },
        scopeMetrics: [{
          metrics: [
            {
              name: "claude_code.cost.usage",
              sum: {
                dataPoints: [{
                  asDouble: 0.0234,
                  timeUnixNano: "1734567890000000000",
                  attributes: []
                }],
                aggregationTemporality: 2,
                isMonotonic: true
              }
            },
            {
              name: "claude_code.token.usage",
              sum: {
                dataPoints: [
                  {
                    asInt: "150",
                    timeUnixNano: "1734567890000000000",
                    attributes: [
                      { key: "type", value: { stringValue: "input" } }
                    ]
                  },
                  {
                    asInt: "250",
                    timeUnixNano: "1734567890000000000",
                    attributes: [
                      { key: "type", value: { stringValue: "output" } }
                    ]
                  }
                ],
                aggregationTemporality: 2,
                isMonotonic: true
              }
            }
          ]
        }]
      }]
    };

    processOTLPMetrics(otlpData);

    // Check that a session was created
    const sessions = db.query("SELECT * FROM sessions WHERE session_id = ?").all("test-session-123");
    expect(sessions.length).toBe(1);
    expect(sessions[0].total_cost).toBe(0.0234);
    expect(sessions[0].total_input_tokens).toBe(150);
    expect(sessions[0].total_output_tokens).toBe(250);

    // Check that a synthetic message was created
    const messages = db.query("SELECT * FROM messages WHERE session_id = ?").all("test-session-123");
    expect(messages.length).toBe(1);
    expect(messages[0].message_id).toContain("synthetic-test-session-123-");
    expect(messages[0].cost).toBe(0.0234);
    expect(messages[0].input_tokens).toBe(150);
    expect(messages[0].output_tokens).toBe(250);
    expect(messages[0].role).toBe("assistant");
  });

  it("should not create duplicate synthetic messages for same resource block", () => {
    const otlpData = {
      resourceMetrics: [{
        resource: {
          attributes: [
            { key: "session_id", value: { stringValue: "test-session-456" } }
          ]
        },
        scopeMetrics: [{
          metrics: [
            {
              name: "claude_code.cost.usage",
              sum: {
                dataPoints: [{
                  asDouble: 0.01,
                  timeUnixNano: "1734567890000000000",
                  attributes: []
                }]
              }
            }
          ]
        }]
      }]
    };

    // Process the same data twice
    processOTLPMetrics(otlpData);
    
    // Should still only have one message (one per resourceMetrics block)
    const messages = db.query("SELECT * FROM messages WHERE session_id = ?").all("test-session-456");
    expect(messages.length).toBe(1);
  });

  it("should still create real messages when message_id is present", () => {
    const otlpData = {
      resourceMetrics: [{
        resource: {
          attributes: [
            { key: "session_id", value: { stringValue: "test-session-789" } }
          ]
        },
        scopeMetrics: [{
          metrics: [
            {
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.05,
                  timeUnixNano: "1734567890000000000",
                  attributes: [
                    { key: "message_id", value: { stringValue: "real-message-123" } },
                    { key: "role", value: { stringValue: "user" } }
                  ]
                }]
              }
            }
          ]
        }]
      }]
    };

    processOTLPMetrics(otlpData);

    const messages = db.query("SELECT * FROM messages WHERE session_id = ?").all("test-session-789");
    expect(messages.length).toBe(1);
    expect(messages[0].message_id).toBe("real-message-123");
    expect(messages[0].role).toBe("user");
  });
});