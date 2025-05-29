import { describe, it, expect, beforeEach } from "bun:test";
import { processOTLPMetrics } from "../../../backend/lib/otlp";
import { db } from "../../../backend/lib/database";

describe("Message Logging", () => {
  beforeEach(() => {
    // Clean up messages table before each test
    db.exec("DELETE FROM messages");
    db.exec("DELETE FROM sessions");
  });

  describe("conversation.message.cost metrics", () => {
    it("should create a message record when receiving message cost metric", () => {
      const otlpData = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: "test-session-123" } },
              { key: "user_id", value: { stringValue: "test-user-456" } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.05,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "msg-001" } },
                    { key: "conversation_id", value: { stringValue: "conv-001" } },
                    { key: "role", value: { stringValue: "assistant" } },
                    { key: "model", value: { stringValue: "claude-3-sonnet" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // Process the OTLP data
      processOTLPMetrics(otlpData);

      // Check that a message was inserted
      const messages = db.query("SELECT * FROM messages WHERE message_id = ?").all("msg-001");
      
      expect(messages.length).toBe(1);
      
      const message = messages[0];
      expect(message.message_id).toBe("msg-001");
      expect(message.session_id).toBe("test-session-123");
      expect(message.conversation_id).toBe("conv-001");
      expect(message.role).toBe("assistant");
      expect(message.model).toBe("claude-3-sonnet");
      expect(message.cost).toBe(0.05);
      expect(message.input_tokens).toBe(0); // Should be 0 initially
      expect(message.output_tokens).toBe(0); // Should be 0 initially
    });

    it("should handle message cost metric without session_id", () => {
      const otlpData = {
        resourceMetrics: [{
          resource: {
            attributes: []
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.03,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "msg-002" } },
                    { key: "role", value: { stringValue: "user" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetrics(otlpData);

      // Should not create a message without session_id
      const messages = db.query("SELECT * FROM messages WHERE message_id = ?").all("msg-002");
      expect(messages.length).toBe(0);
    });

    it("should handle message cost metric without message_id", () => {
      const otlpData = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: "test-session-123" } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.03,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "role", value: { stringValue: "user" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetrics(otlpData);

      // Should not create a message without message_id
      const messages = db.query("SELECT * FROM messages").all();
      expect(messages.length).toBe(0);
    });
  });

  describe("conversation.message.tokens metrics", () => {
    it("should update message tokens when receiving token metrics", () => {
      // First, create a message with cost metric
      const costMetric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: "test-session-123" } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.05,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "msg-003" } },
                    { key: "role", value: { stringValue: "assistant" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetrics(costMetric);

      // Then send token metrics
      const tokenMetric = {
        resourceMetrics: [{
          resource: {
            attributes: []
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 1500,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "msg-003" } },
                    { key: "type", value: { stringValue: "input" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetrics(tokenMetric);

      // Check that tokens were updated
      const messages = db.query("SELECT * FROM messages WHERE message_id = ?").all("msg-003");
      
      expect(messages.length).toBe(1);
      
      const message = messages[0];
      expect(message.input_tokens).toBe(1500);
      expect(message.output_tokens).toBe(0);
    });

    it("should handle multiple token types for the same message", () => {
      // Create message first
      const costMetric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: "test-session-123" } }
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
                    { key: "message_id", value: { stringValue: "msg-004" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetrics(costMetric);

      // Send input tokens
      const inputTokens = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 1200,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "msg-004" } },
                    { key: "type", value: { stringValue: "input" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // Send output tokens
      const outputTokens = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 800,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "msg-004" } },
                    { key: "type", value: { stringValue: "output" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetrics(inputTokens);
      processOTLPMetrics(outputTokens);

      // Check that both token types were recorded
      const messages = db.query("SELECT * FROM messages WHERE message_id = ?").all("msg-004");
      
      expect(messages.length).toBe(1);
      
      const message = messages[0];
      expect(message.input_tokens).toBe(1200);
      expect(message.output_tokens).toBe(800);
    });

    it("should not update tokens for non-existent message", () => {
      const tokenMetric = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 1000,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "non-existent-msg" } },
                    { key: "type", value: { stringValue: "input" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // This should not crash, but also shouldn't create any messages
      expect(() => processOTLPMetrics(tokenMetric)).not.toThrow();
      
      const messages = db.query("SELECT * FROM messages").all();
      expect(messages.length).toBe(0);
    });
  });

  describe("End-to-End Message Flow", () => {
    it("should create session, message, and update tokens in correct order", () => {
      // 1. Session creation metric
      const sessionMetric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: "session-e2e" } },
              { key: "user_id", value: { stringValue: "user-e2e" } },
              { key: "user.email", value: { stringValue: "test@example.com" } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "claude_code.cost.usage",
              sum: {
                dataPoints: [{
                  asDouble: 0.10,
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

      // 2. Message cost metric
      const messageCostMetric = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "session_id", value: { stringValue: "session-e2e" } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.cost",
              sum: {
                dataPoints: [{
                  asDouble: 0.05,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "msg-e2e" } },
                    { key: "conversation_id", value: { stringValue: "conv-e2e" } },
                    { key: "role", value: { stringValue: "assistant" } },
                    { key: "model", value: { stringValue: "claude-3-sonnet" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // 3. Message token metrics
      const tokenMetrics = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            metrics: [{
              name: "conversation.message.tokens",
              sum: {
                dataPoints: [{
                  asDouble: 2000,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: [
                    { key: "message_id", value: { stringValue: "msg-e2e" } },
                    { key: "type", value: { stringValue: "input" } }
                  ]
                }]
              }
            }]
          }]
        }]
      };

      // Process in order
      processOTLPMetrics(sessionMetric);
      processOTLPMetrics(messageCostMetric);
      processOTLPMetrics(tokenMetrics);

      // Verify session was created
      const sessions = db.query("SELECT * FROM sessions WHERE session_id = ?").all("session-e2e");
      expect(sessions.length).toBe(1);
      expect(sessions[0].user_id).toBe("user-e2e");

      // Verify message was created and updated
      const messages = db.query("SELECT * FROM messages WHERE message_id = ?").all("msg-e2e");
      expect(messages.length).toBe(1);
      
      const message = messages[0];
      expect(message.session_id).toBe("session-e2e");
      expect(message.conversation_id).toBe("conv-e2e");
      expect(message.role).toBe("assistant");
      expect(message.model).toBe("claude-3-sonnet");
      expect(message.cost).toBe(0.05);
      expect(message.input_tokens).toBe(2000);
    });
  });
});