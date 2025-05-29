import { describe, it, expect, beforeEach } from "bun:test";
import { processOTLPMetricsTest } from "../../../backend/lib/otlp-test";
import { testDb } from "../../../backend/lib/test-database";

describe("OTLP Message Extraction Behavior Documentation", () => {
  beforeEach(() => {
    // Clean up test data
    testDb.exec("DELETE FROM messages WHERE message_id LIKE 'behavior-%'");
    testDb.exec("DELETE FROM sessions WHERE session_id LIKE 'behavior-%'");
    testDb.exec("DELETE FROM metrics WHERE session_id LIKE 'behavior-%'");
  });

  describe("Current implementation behavior", () => {
    it("accumulates values across different metrics but not within same metric", () => {
      const sessionId = "behavior-session-accumulation";
      
      // Session metric
      const sessionMetric = {
        resourceMetrics: [{
          resource: {
            attributes: [{ key: "session_id", value: { stringValue: sessionId } }]
          },
          scopeMetrics: [{
            metrics: [{
              name: "claude_code.cost.usage",
              sum: {
                dataPoints: [{
                  asDouble: 0.10,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: []
                }]
              }
            }]
          }]
        }]
      };

      // First message cost metric
      const firstCostMetric = {
        resourceMetrics: [{
          resource: {
            attributes: [{ key: "session_id", value: { stringValue: sessionId } }]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.05,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "behavior-msg-accum" } },
                    { key: "role", value: { stringValue: "assistant" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // Second message cost metric (simulating another batch)
      const secondCostMetric = {
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
                    { key: "message_id", value: { stringValue: "behavior-msg-accum" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetricsTest(sessionMetric);
      processOTLPMetricsTest(firstCostMetric);
      processOTLPMetricsTest(secondCostMetric);

      const message = testDb.query("SELECT * FROM messages WHERE message_id = ?").get("behavior-msg-accum");
      expect(message).toBeTruthy();
      // Values from different processOTLPMetrics calls ARE accumulated (when updating existing message)
      // Note: claude_code.cost.usage in a separate call doesn't add to message cost
      expect(message.cost).toBe(0.08); // 0.05 (first) + 0.03 (second update)
    });

    it("requires session_id in resource attributes for token updates", () => {
      const sessionId = "behavior-session-tokens";
      
      // Create message with session_id
      const messageMetric = {
        resourceMetrics: [{
          resource: {
            attributes: [{ key: "session_id", value: { stringValue: sessionId } }]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.01,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "behavior-msg-tokens" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // Token metric WITH session_id in resource
      const tokenWithSession = {
        resourceMetrics: [{
          resource: {
            attributes: [{ key: "session_id", value: { stringValue: sessionId } }]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 500,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "behavior-msg-tokens" } },
                    { key: "type", value: { stringValue: "input" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // Token metric WITHOUT session_id in resource
      const tokenWithoutSession = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 300,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "behavior-msg-tokens" } },
                    { key: "type", value: { stringValue: "output" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetricsTest(messageMetric);
      processOTLPMetricsTest(tokenWithSession);
      processOTLPMetricsTest(tokenWithoutSession);

      const message = testDb.query("SELECT * FROM messages WHERE message_id = ?").get("behavior-msg-tokens");
      expect(message).toBeTruthy();
      expect(message.input_tokens).toBe(500); // Updated because session_id was in resource
      expect(message.output_tokens).toBe(0);  // Not updated because session_id was missing
    });

    it("stores empty strings as NULL in database", () => {
      const sessionId = "behavior-session-nulls";
      
      const metricWithEmptyStrings = {
        resourceMetrics: [{
          resource: {
            attributes: [{ key: "session_id", value: { stringValue: sessionId } }]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.01,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "behavior-msg-nulls" } },
                    { key: "role", value: { stringValue: "" } },
                    { key: "model", value: { stringValue: "" } },
                    { key: "conversation_id", value: { stringValue: "valid-conv-id" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetricsTest(metricWithEmptyStrings);

      const message = testDb.query("SELECT * FROM messages WHERE message_id = ?").get("behavior-msg-nulls");
      expect(message).toBeTruthy();
      expect(message.role).toBeNull(); // Empty string becomes NULL
      expect(message.model).toBeNull(); // Empty string becomes NULL
      expect(message.conversation_id).toBe("valid-conv-id"); // Non-empty strings are preserved
    });

    it("uses updateMessage for existing messages to accumulate values", () => {
      const sessionId = "behavior-session-update";
      
      // First insert
      const firstInsert = {
        resourceMetrics: [{
          resource: {
            attributes: [{ key: "session_id", value: { stringValue: sessionId } }]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.05,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "behavior-msg-update" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // Second update (same message_id)
      const secondUpdate = {
        resourceMetrics: [{
          resource: {
            attributes: [{ key: "session_id", value: { stringValue: sessionId } }]
          },
          scopeMetrics: [{
            metrics: [
              {
                name: "conversation.message.cost",
                sum: {
                  dataPoints: [{
                    asDouble: 0.03,
                    timeUnixNano: Date.now() * 1000000,
                    attributes: [
                      { key: "message_id", value: { stringValue: "behavior-msg-update" } }
                    ]
                  }]
                }
              },
              {
                name: "conversation.message.tokens",
                sum: {
                  dataPoints: [{
                    asDouble: 200,
                    timeUnixNano: Date.now() * 1000000,
                    attributes: [
                      { key: "message_id", value: { stringValue: "behavior-msg-update" } },
                      { key: "type", value: { stringValue: "input" } }
                    ]
                  }]
                }
              }
            ]
          }]
        }]
      };

      processOTLPMetricsTest(firstInsert);
      processOTLPMetricsTest(secondUpdate);

      const message = testDb.query("SELECT * FROM messages WHERE message_id = ?").get("behavior-msg-update");
      expect(message).toBeTruthy();
      expect(message.cost).toBe(0.08); // 0.05 + 0.03
      expect(message.input_tokens).toBe(200);
    });
  });

  describe("Message saving requirements", () => {
    it("requires both session_id and message_id to save a message", () => {
      // Missing session_id
      const noSession = {
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
                    { key: "message_id", value: { stringValue: "behavior-no-session" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // Missing message_id
      const noMessage = {
        resourceMetrics: [{
          resource: {
            attributes: [{ key: "session_id", value: { stringValue: "behavior-session-no-msg" } }]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.05,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "role", value: { stringValue: "assistant" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetricsTest(noSession);
      processOTLPMetricsTest(noMessage);

      // Neither should create messages
      const messages = testDb.query("SELECT * FROM messages WHERE message_id IN (?, ?)").all("behavior-no-session", "behavior-no-message");
      expect(messages.length).toBe(0);

      // But metrics should still be stored
      const metrics = testDb.query("SELECT COUNT(*) as count FROM metrics WHERE metric_name = 'conversation.message.cost'").get();
      expect(metrics.count).toBeGreaterThanOrEqual(2);
    });
  });
});