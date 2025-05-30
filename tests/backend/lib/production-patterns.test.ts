import { describe, it, expect, beforeEach } from "bun:test";
import { processOTLPMetricsTest } from "../../../backend/lib/otlp-test";
import { testDb } from "../../../backend/lib/test-database";

describe("Production Pattern OTLP Tests", () => {
  beforeEach(() => {
    // Clean up test data
    testDb.exec("DELETE FROM messages WHERE message_id LIKE 'prod-%'");
    testDb.exec("DELETE FROM sessions WHERE session_id LIKE 'prod-%'");
    testDb.exec("DELETE FROM metrics WHERE session_id LIKE 'prod-%'");
  });

  describe("Claude Code Session Metrics Patterns", () => {
    it("should process typical claude-code session metrics with high cache usage", () => {
      // This pattern is based on production metric structures (with sanitized data)
      const sessionMetricsPattern = {
        "resourceMetrics": [{
          "resource": {
            "attributes": [
              {"key": "service.name", "value": {"stringValue": "claude-code"}},
              {"key": "service.version", "value": {"stringValue": "1.0.5"}}
            ],
            "droppedAttributesCount": 0
          },
          "scopeMetrics": [{
            "scope": {
              "name": "com.anthropic.claude_code",
              "version": "1.0.5"
            },
            "metrics": [
              {
                "name": "claude_code.cost.usage",
                "description": "Cost of the Claude Code session",
                "unit": "USD",
                "sum": {
                  "aggregationTemporality": 1,
                  "isMonotonic": true,
                  "dataPoints": [{
                    "attributes": [
                      {"key": "user.id", "value": {"stringValue": "test-user-abc123"}},
                      {"key": "session.id", "value": {"stringValue": "prod-session-def456"}},
                      {"key": "organization.id", "value": {"stringValue": "test-org-ghi789"}},
                      {"key": "user.email", "value": {"stringValue": "testuser@example.org"}},
                      {"key": "user.account_uuid", "value": {"stringValue": "test-account-uuid-xyz"}},
                      {"key": "model", "value": {"stringValue": "claude-opus-4-20250514"}}
                    ],
                    "startTimeUnixNano": "1748530951075000000",
                    "timeUnixNano": "1748530951980000000",
                    "asDouble": 0.14637375
                  }]
                }
              },
              {
                "name": "claude_code.token.usage",
                "description": "Number of tokens used",
                "unit": "tokens",
                "sum": {
                  "aggregationTemporality": 1,
                  "isMonotonic": true,
                  "dataPoints": [
                    {
                      "attributes": [
                        {"key": "user.id", "value": {"stringValue": "test-user-abc123"}},
                        {"key": "session.id", "value": {"stringValue": "prod-session-def456"}},
                        {"key": "organization.id", "value": {"stringValue": "test-org-ghi789"}},
                        {"key": "user.email", "value": {"stringValue": "testuser@example.org"}},
                        {"key": "user.account_uuid", "value": {"stringValue": "test-account-uuid-xyz"}},
                        {"key": "type", "value": {"stringValue": "input"}},
                        {"key": "model", "value": {"stringValue": "claude-opus-4-20250514"}}
                      ],
                      "startTimeUnixNano": "1748530951075000000",
                      "timeUnixNano": "1748530951980000000",
                      "asDouble": 2
                    },
                    {
                      "attributes": [
                        {"key": "user.id", "value": {"stringValue": "test-user-abc123"}},
                        {"key": "session.id", "value": {"stringValue": "prod-session-def456"}},
                        {"key": "organization.id", "value": {"stringValue": "test-org-ghi789"}},
                        {"key": "user.email", "value": {"stringValue": "testuser@example.org"}},
                        {"key": "user.account_uuid", "value": {"stringValue": "test-account-uuid-xyz"}},
                        {"key": "type", "value": {"stringValue": "output"}},
                        {"key": "model", "value": {"stringValue": "claude-opus-4-20250514"}}
                      ],
                      "startTimeUnixNano": "1748530951075000000",
                      "timeUnixNano": "1748530951980000000",
                      "asDouble": 413
                    },
                    {
                      "attributes": [
                        {"key": "user.id", "value": {"stringValue": "test-user-abc123"}},
                        {"key": "session.id", "value": {"stringValue": "prod-session-def456"}},
                        {"key": "organization.id", "value": {"stringValue": "test-org-ghi789"}},
                        {"key": "user.email", "value": {"stringValue": "testuser@example.org"}},
                        {"key": "user.account_uuid", "value": {"stringValue": "test-account-uuid-xyz"}},
                        {"key": "type", "value": {"stringValue": "cacheRead"}},
                        {"key": "model", "value": {"stringValue": "claude-opus-4-20250514"}}
                      ],
                      "startTimeUnixNano": "1748530951075000000",
                      "timeUnixNano": "1748530951980000000",
                      "asDouble": 33975
                    },
                    {
                      "attributes": [
                        {"key": "user.id", "value": {"stringValue": "test-user-abc123"}},
                        {"key": "session.id", "value": {"stringValue": "prod-session-def456"}},
                        {"key": "organization.id", "value": {"stringValue": "test-org-ghi789"}},
                        {"key": "user.email", "value": {"stringValue": "testuser@example.org"}},
                        {"key": "user.account_uuid", "value": {"stringValue": "test-account-uuid-xyz"}},
                        {"key": "type", "value": {"stringValue": "cacheCreation"}},
                        {"key": "model", "value": {"stringValue": "claude-opus-4-20250514"}}
                      ],
                      "startTimeUnixNano": "1748530951075000000",
                      "timeUnixNano": "1748530951980000000",
                      "asDouble": 3435
                    }
                  ]
                }
              }
            ]
          }]
        }]
      };

      processOTLPMetricsTest(sessionMetricsPattern);

      // Verify session was created with sanitized test data
      const session = testDb.query("SELECT * FROM sessions WHERE session_id = ?").get("prod-session-def456");
      expect(session).toBeTruthy();
      expect(session.user_id).toBe("test-user-abc123");
      expect(session.user_email).toBe("testuser@example.org");
      expect(session.organization_id).toBe("test-org-ghi789");
      expect(session.model).toBe("claude-opus-4-20250514");
      expect(session.total_cost).toBe(0.14637375);
      expect(session.total_input_tokens).toBe(2);
      expect(session.total_output_tokens).toBe(413);
      expect(session.total_cache_read_tokens).toBe(33975);
      expect(session.total_cache_creation_tokens).toBe(3435);

      // Verify metrics were stored (1 cost + 4 token metrics = 5 total)
      const metrics = testDb.query("SELECT COUNT(*) as count FROM metrics WHERE session_id = ?").get("prod-session-def456");
      expect(metrics.count).toBe(5);
    });

    it("should process conversation message patterns", () => {
      // Pattern based on conversation message structure (with sanitized data)
      const messagePattern = {
        "resourceMetrics": [{
          "resource": {
            "attributes": [
              {"key": "session_id", "value": {"stringValue": "prod-session-messages"}},
              {"key": "user_id", "value": {"stringValue": "test-user-msg123"}}
            ]
          },
          "scopeMetrics": [{
            "metrics": [
              {
                "name": "conversation.message.cost",
                "sum": {
                  "dataPoints": [{
                    "asDouble": 0.08,
                    "timeUnixNano": 1748545139000000000,
                    "attributes": [
                      {"key": "message_id", "value": {"stringValue": "prod-msg-001"}},
                      {"key": "role", "value": {"stringValue": "assistant"}},
                      {"key": "conversation_id", "value": {"stringValue": "prod-conv-001"}}
                    ]
                  }]
                }
              },
              {
                "name": "conversation.message.tokens",
                "sum": {
                  "dataPoints": [
                    {
                      "asDouble": 1200,
                      "timeUnixNano": 1748545139000000000,
                      "attributes": [
                        {"key": "message_id", "value": {"stringValue": "prod-msg-001"}},
                        {"key": "type", "value": {"stringValue": "input"}}
                      ]
                    },
                    {
                      "asDouble": 800,
                      "timeUnixNano": 1748545139000000000,
                      "attributes": [
                        {"key": "message_id", "value": {"stringValue": "prod-msg-001"}},
                        {"key": "type", "value": {"stringValue": "output"}}
                      ]
                    }
                  ]
                }
              }
            ]
          }]
        }]
      };

      processOTLPMetricsTest(messagePattern);

      // Verify session was created
      const session = testDb.query("SELECT * FROM sessions WHERE session_id = ?").get("prod-session-messages");
      expect(session).toBeTruthy();
      expect(session.user_id).toBe("test-user-msg123");

      // Verify message was created and populated correctly
      const message = testDb.query("SELECT * FROM messages WHERE message_id = ?").get("prod-msg-001");
      expect(message).toBeTruthy();
      expect(message.session_id).toBe("prod-session-messages");
      expect(message.conversation_id).toBe("prod-conv-001");
      expect(message.role).toBe("assistant");
      expect(message.cost).toBe(0.08);
      expect(message.input_tokens).toBe(1200);
      expect(message.output_tokens).toBe(800);
      expect(message.cache_creation_tokens).toBe(0);
      expect(message.cache_read_tokens).toBe(0);
    });

    it("should handle haiku model usage patterns", () => {
      // Pattern based on haiku model usage (with sanitized data)
      const haikuPattern = {
        "resourceMetrics": [{
          "resource": {
            "attributes": [
              {"key": "service.name", "value": {"stringValue": "claude-code"}},
              {"key": "service.version", "value": {"stringValue": "1.0.5"}}
            ]
          },
          "scopeMetrics": [{
            "scope": {
              "name": "com.anthropic.claude_code",
              "version": "1.0.5"
            },
            "metrics": [
              {
                "name": "claude_code.cost.usage",
                "description": "Cost of the Claude Code session",
                "unit": "USD",
                "sum": {
                  "aggregationTemporality": 1,
                  "isMonotonic": true,
                  "dataPoints": [{
                    "attributes": [
                      {"key": "user.id", "value": {"stringValue": "test-haiku-user456"}},
                      {"key": "session.id", "value": {"stringValue": "prod-haiku-session"}},
                      {"key": "organization.id", "value": {"stringValue": "test-haiku-org789"}},
                      {"key": "user.email", "value": {"stringValue": "haiku-test@example.org"}},
                      {"key": "model", "value": {"stringValue": "claude-3-5-haiku-20241022"}}
                    ],
                    "startTimeUnixNano": "1748530956967000000",
                    "timeUnixNano": "1748530956982000000",
                    "asDouble": 0.0782925
                  }]
                }
              },
              {
                "name": "claude_code.token.usage",
                "description": "Number of tokens used",
                "unit": "tokens",
                "sum": {
                  "aggregationTemporality": 1,
                  "isMonotonic": true,
                  "dataPoints": [
                    {
                      "attributes": [
                        {"key": "user.id", "value": {"stringValue": "test-haiku-user456"}},
                        {"key": "session.id", "value": {"stringValue": "prod-haiku-session"}},
                        {"key": "type", "value": {"stringValue": "input"}},
                        {"key": "model", "value": {"stringValue": "claude-3-5-haiku-20241022"}}
                      ],
                      "startTimeUnixNano": "1748530956967000000",
                      "timeUnixNano": "1748530956982000000",
                      "asDouble": 1
                    },
                    {
                      "attributes": [
                        {"key": "user.id", "value": {"stringValue": "test-haiku-user456"}},
                        {"key": "session.id", "value": {"stringValue": "prod-haiku-session"}},
                        {"key": "type", "value": {"stringValue": "output"}},
                        {"key": "model", "value": {"stringValue": "claude-3-5-haiku-20241022"}}
                      ],
                      "startTimeUnixNano": "1748530956967000000",
                      "timeUnixNano": "1748530956982000000",
                      "asDouble": 109
                    },
                    {
                      "attributes": [
                        {"key": "user.id", "value": {"stringValue": "test-haiku-user456"}},
                        {"key": "session.id", "value": {"stringValue": "prod-haiku-session"}},
                        {"key": "type", "value": {"stringValue": "cacheRead"}},
                        {"key": "model", "value": {"stringValue": "claude-3-5-haiku-20241022"}}
                      ],
                      "startTimeUnixNano": "1748530956967000000",
                      "timeUnixNano": "1748530956982000000",
                      "asDouble": 37410
                    },
                    {
                      "attributes": [
                        {"key": "user.id", "value": {"stringValue": "test-haiku-user456"}},
                        {"key": "session.id", "value": {"stringValue": "prod-haiku-session"}},
                        {"key": "type", "value": {"stringValue": "cacheCreation"}},
                        {"key": "model", "value": {"stringValue": "claude-3-5-haiku-20241022"}}
                      ],
                      "startTimeUnixNano": "1748530956967000000",
                      "timeUnixNano": "1748530956982000000",
                      "asDouble": 746
                    }
                  ]
                }
              }
            ]
          }]
        }]
      };

      processOTLPMetricsTest(haikuPattern);

      // Verify session with haiku model
      const session = testDb.query("SELECT * FROM sessions WHERE session_id = ?").get("prod-haiku-session");
      expect(session).toBeTruthy();
      expect(session.user_id).toBe("test-haiku-user456");
      expect(session.user_email).toBe("haiku-test@example.org");
      expect(session.model).toBe("claude-3-5-haiku-20241022");
      expect(session.total_cost).toBe(0.0782925);
      expect(session.total_input_tokens).toBe(1);
      expect(session.total_output_tokens).toBe(109);
      expect(session.total_cache_read_tokens).toBe(37410);
      expect(session.total_cache_creation_tokens).toBe(746);
    });
  });

  describe("Non-session Metric Patterns", () => {
    it("should handle code editing tool decision patterns", () => {
      // Pattern for tool permission tracking (with sanitized data)
      const toolDecisionPattern = {
        "resourceMetrics": [{
          "resource": {
            "attributes": [
              {"key": "service.name", "value": {"stringValue": "claude-code"}},
              {"key": "service.version", "value": {"stringValue": "1.0.5"}}
            ]
          },
          "scopeMetrics": [{
            "scope": {
              "name": "com.anthropic.claude_code",
              "version": "1.0.5"
            },
            "metrics": [{
              "name": "claude_code.code_edit_tool.decision",
              "description": "Count of code editing tool permission decisions",
              "unit": "",
              "sum": {
                "aggregationTemporality": 1,
                "isMonotonic": true,
                "dataPoints": [{
                  "attributes": [
                    {"key": "user.id", "value": {"stringValue": "test-edit-user789"}},
                    {"key": "session.id", "value": {"stringValue": "test-edit-session"}},
                    {"key": "organization.id", "value": {"stringValue": "test-edit-org123"}},
                    {"key": "user.email", "value": {"stringValue": "editor-test@example.org"}},
                    {"key": "user.account_uuid", "value": {"stringValue": "test-edit-account-uuid"}},
                    {"key": "decision", "value": {"stringValue": "accept"}},
                    {"key": "source", "value": {"stringValue": "config"}},
                    {"key": "tool_name", "value": {"stringValue": "Edit"}}
                  ],
                  "startTimeUnixNano": "1748530951088000000",
                  "timeUnixNano": "1748530951980000000",
                  "asDouble": 1
                }]
              }
            }]
          }]
        }]
      };

      processOTLPMetricsTest(toolDecisionPattern);

      // Tool decision metrics now create sessions (simplified approach)
      const session = testDb.query("SELECT * FROM sessions WHERE session_id = ?").get("test-edit-session");
      expect(session).toBeTruthy();
      expect(session.user_id).toBe("test-edit-user789");

      // Verify metric was stored
      const metrics = testDb.query("SELECT * FROM metrics WHERE metric_name = ?")
        .all("claude_code.code_edit_tool.decision");
      expect(metrics.length).toBe(1);
      expect(metrics[0].metric_value).toBe(1);
      
      const labels = JSON.parse(metrics[0].labels);
      expect(labels.decision).toBe("accept");
      expect(labels.tool_name).toBe("Edit");
      expect(labels.source).toBe("config");
    });

    it("should handle lines of code tracking patterns", () => {
      // Pattern for development activity tracking (with sanitized data)
      const lineCountPattern = {
        "resourceMetrics": [{
          "resource": {
            "attributes": [
              {"key": "service.name", "value": {"stringValue": "claude-code"}},
              {"key": "service.version", "value": {"stringValue": "1.0.5"}}
            ]
          },
          "scopeMetrics": [{
            "scope": {
              "name": "com.anthropic.claude_code",
              "version": "1.0.5"
            },
            "metrics": [{
              "name": "claude_code.lines_of_code.count",
              "description": "Count of lines of code modified",
              "unit": "",
              "sum": {
                "aggregationTemporality": 1,
                "isMonotonic": true,
                "dataPoints": [
                  {
                    "attributes": [
                      {"key": "user.id", "value": {"stringValue": "test-coder-user456"}},
                      {"key": "session.id", "value": {"stringValue": "test-coding-session"}},
                      {"key": "organization.id", "value": {"stringValue": "test-coding-org789"}},
                      {"key": "user.email", "value": {"stringValue": "coder-test@example.org"}},
                      {"key": "user.account_uuid", "value": {"stringValue": "test-coding-account-uuid"}},
                      {"key": "type", "value": {"stringValue": "added"}}
                    ],
                    "startTimeUnixNano": "1748530951095000000",
                    "timeUnixNano": "1748530951980000000",
                    "asDouble": 2
                  },
                  {
                    "attributes": [
                      {"key": "user.id", "value": {"stringValue": "test-coder-user456"}},
                      {"key": "session.id", "value": {"stringValue": "test-coding-session"}},
                      {"key": "organization.id", "value": {"stringValue": "test-coding-org789"}},
                      {"key": "user.email", "value": {"stringValue": "coder-test@example.org"}},
                      {"key": "user.account_uuid", "value": {"stringValue": "test-coding-account-uuid"}},
                      {"key": "type", "value": {"stringValue": "removed"}}
                    ],
                    "startTimeUnixNano": "1748530951095000000",
                    "timeUnixNano": "1748530951980000000",
                    "asDouble": 2
                  }
                ]
              }
            }]
          }]
        }]
      };

      processOTLPMetricsTest(lineCountPattern);

      // Line count metrics now create sessions (simplified approach)
      const session = testDb.query("SELECT * FROM sessions WHERE session_id = ?").get("test-coding-session");
      expect(session).toBeTruthy();
      expect(session.user_id).toBe("test-coder-user456");

      // Verify both line count metrics were stored
      const metrics = testDb.query("SELECT * FROM metrics WHERE metric_name = ?")
        .all("claude_code.lines_of_code.count");
      expect(metrics.length).toBe(2);
      
      const addedMetric = metrics.find(m => JSON.parse(m.labels).type === "added");
      const removedMetric = metrics.find(m => JSON.parse(m.labels).type === "removed");
      
      expect(addedMetric).toBeTruthy();
      expect(addedMetric.metric_value).toBe(2);
      expect(removedMetric).toBeTruthy();
      expect(removedMetric.metric_value).toBe(2);
    });
  });
});