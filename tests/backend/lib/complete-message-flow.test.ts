import { describe, it, expect, beforeEach } from "bun:test";
import { processOTLPMetricsTest } from "../../../backend/lib/otlp-test";
import { testDb } from "../../../backend/lib/test-database";

describe("Complete Message Flow Integration", () => {
  beforeEach(() => {
    // Clean up before each test
    testDb.exec("DELETE FROM messages WHERE message_id LIKE 'flow-%'");
    testDb.exec("DELETE FROM sessions WHERE session_id LIKE 'flow-%'");
    testDb.exec("DELETE FROM metrics WHERE session_id LIKE 'flow-%'");
  });

  describe("Real-world OTLP message scenarios", () => {
    it("should handle complete conversation flow with multiple messages", () => {
      const sessionId = "flow-session-001";
      const userId = "flow-user-001";

      // 1. Session initialization
      const sessionInit = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: sessionId } },
              { key: "user_id", value: { stringValue: userId } },
              { key: "user.email", value: { stringValue: "test@example.com" } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "claude_code.cost.usage",
              sum: {
                dataPoints: [{
                  asDouble: 0.15,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "model", value: { stringValue: "claude-3-sonnet" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // 2. User message cost
      const userMessageCost = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: sessionId } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.02,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "flow-msg-user-001" } },
                    { key: "conversation_id", value: { stringValue: "flow-conv-001" } },
                    { key: "role", value: { stringValue: "user" } },
                    { key: "model", value: { stringValue: "claude-3-sonnet" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // 3. User message tokens
      const userMessageTokens = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: sessionId } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 150,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "flow-msg-user-001" } },
                    { key: "type", value: { stringValue: "input" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // 4. Assistant message cost
      const assistantMessageCost = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: sessionId } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.08,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "flow-msg-assistant-001" } },
                    { key: "conversation_id", value: { stringValue: "flow-conv-001" } },
                    { key: "role", value: { stringValue: "assistant" } },
                    { key: "model", value: { stringValue: "claude-3-sonnet" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // 5. Assistant message tokens (input and output)
      const assistantInputTokens = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: sessionId } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 1200,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "flow-msg-assistant-001" } },
                    { key: "type", value: { stringValue: "input" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      const assistantOutputTokens = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: sessionId } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 800,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "flow-msg-assistant-001" } },
                    { key: "type", value: { stringValue: "output" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // Process all metrics in realistic order
      processOTLPMetricsTest(sessionInit);
      processOTLPMetricsTest(userMessageCost);
      processOTLPMetricsTest(userMessageTokens);
      processOTLPMetricsTest(assistantMessageCost);
      processOTLPMetricsTest(assistantInputTokens);
      processOTLPMetricsTest(assistantOutputTokens);

      // Verify session was created
      const session = testDb.query("SELECT * FROM sessions WHERE session_id = ?").get(sessionId);
      expect(session).toBeTruthy();
      expect(session.user_id).toBe(userId);
      expect(session.total_cost).toBe(0.25); // Simplified approach accumulates differently

      // Verify both messages were created
      const messages = testDb.query("SELECT * FROM messages WHERE session_id = ? ORDER BY message_id").all(sessionId);
      expect(messages.length).toBe(2);

      // Verify user message
      const userMessage = messages.find((m: any) => m.role === "user");
      expect(userMessage).toBeTruthy();
      expect(userMessage.message_id).toBe("flow-msg-user-001");
      expect(userMessage.conversation_id).toBe("flow-conv-001");
      expect(userMessage.cost).toBe(0.02);
      expect(userMessage.input_tokens).toBe(150);
      expect(userMessage.output_tokens).toBe(0);

      // Verify assistant message
      const assistantMessage = messages.find((m: any) => m.role === "assistant");
      expect(assistantMessage).toBeTruthy();
      expect(assistantMessage.message_id).toBe("flow-msg-assistant-001");
      expect(assistantMessage.conversation_id).toBe("flow-conv-001");
      expect(assistantMessage.cost).toBe(0.08);
      expect(assistantMessage.input_tokens).toBe(1200);
      expect(assistantMessage.output_tokens).toBe(800);

      // Verify cost metrics were stored with session_id
      const costMetrics = testDb.query(`
        SELECT COUNT(*) as count 
        FROM metrics 
        WHERE session_id = ? AND metric_name = 'conversation.message.cost'
      `).get(sessionId);
      expect(costMetrics.count).toBe(2);

      // Verify token metrics were stored (may not have session_id)
      const tokenMetrics = testDb.query(`
        SELECT COUNT(*) as count 
        FROM metrics 
        WHERE metric_name = 'conversation.message.tokens'
        AND labels LIKE '%flow-msg-%'
      `).get();
      expect(tokenMetrics.count).toBeGreaterThanOrEqual(3);
    });

    it("should reject messages without session_id but still store metrics", () => {
      const messageWithoutSession = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.05,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "flow-msg-orphan" } },
                    { key: "role", value: { stringValue: "user" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetricsTest(messageWithoutSession);

      // Should not create message
      const messages = testDb.query("SELECT * FROM messages WHERE message_id = ?").all("flow-msg-orphan");
      expect(messages.length).toBe(0);

      // But should still store the metric
      const metrics = testDb.query("SELECT * FROM metrics WHERE metric_name = 'conversation.message.cost'").all();
      const orphanMetric = metrics.find((m: any) => {
        try {
          const labels = JSON.parse(m.labels);
          return labels.message_id === "flow-msg-orphan";
        } catch {
          return false;
        }
      });
      expect(orphanMetric).toBeTruthy();
    });

    it("should handle cache tokens correctly", () => {
      const sessionId = "flow-session-cache";

      // Create session first
      const sessionMetric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: sessionId } },
              { key: "user_id", value: { stringValue: "cache-user" } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "claude_code.cost.usage",
              sum: {
                dataPoints: [{
                  asDouble: 0.05,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: []
                }]
              }
            }]
          }]
        }]
      };

      // Message with cache tokens
      const messageCost = {
        resourceMetrics: [{
          resource: {
            attributes: [{ key: "session_id", value: { stringValue: sessionId } }]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.03,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "flow-msg-cache" } },
                    { key: "role", value: { stringValue: "assistant" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      const cacheReadTokens = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: sessionId } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 500,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "flow-msg-cache" } },
                    { key: "type", value: { stringValue: "cache_read" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      const cacheCreationTokens = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: sessionId } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 200,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "flow-msg-cache" } },
                    { key: "type", value: { stringValue: "cache_creation" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetricsTest(sessionMetric);
      processOTLPMetricsTest(messageCost);
      processOTLPMetricsTest(cacheReadTokens);
      processOTLPMetricsTest(cacheCreationTokens);

      // Verify cache tokens were recorded
      const message = testDb.query("SELECT * FROM messages WHERE message_id = ?").get("flow-msg-cache");
      expect(message).toBeTruthy();
      expect(message.cache_read_tokens).toBe(500);
      expect(message.cache_creation_tokens).toBe(200);
      expect(message.input_tokens).toBe(0); // Should remain 0
      expect(message.output_tokens).toBe(0); // Should remain 0
    });
  });
});