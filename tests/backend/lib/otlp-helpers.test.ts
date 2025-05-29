import { describe, test, expect } from "bun:test";
import {
  extractSessionInfo,
  parseTokenMetric,
  parseMessageInfo,
  getMetricType,
  extractMetricValue,
  shouldProcessSession,
  isMessageMetric
} from "../../../backend/lib/otlp-helpers";

describe("OTLP Helpers", () => {
  describe("extractSessionInfo", () => {
    test("should extract session info from datapoint attributes", () => {
      const dpAttributes = [
        { key: "session.id", value: { stringValue: "session-123" } },
        { key: "user.id", value: { stringValue: "user-456" } },
        { key: "user.email", value: { stringValue: "test@example.com" } }
      ];
      const resourceAttributes = [];

      const result = extractSessionInfo(dpAttributes, resourceAttributes);

      expect(result.sessionId).toBe("session-123");
      expect(result.userId).toBe("user-456");
      expect(result.userEmail).toBe("test@example.com");
    });

    test("should extract session info from resource attributes", () => {
      const dpAttributes = [];
      const resourceAttributes = [
        { key: "session.id", value: { stringValue: "resource-session-789" } },
        { key: "organization.id", value: { stringValue: "org-123" } },
        { key: "model", value: { stringValue: "claude-3-sonnet" } }
      ];

      const result = extractSessionInfo(dpAttributes, resourceAttributes);

      expect(result.sessionId).toBe("resource-session-789");
      expect(result.orgId).toBe("org-123");
      expect(result.model).toBe("claude-3-sonnet");
    });

    test("should prioritize datapoint attributes over resource attributes", () => {
      const dpAttributes = [
        { key: "session.id", value: { stringValue: "dp-session" } }
      ];
      const resourceAttributes = [
        { key: "session.id", value: { stringValue: "resource-session" } }
      ];

      const result = extractSessionInfo(dpAttributes, resourceAttributes);

      expect(result.sessionId).toBe("dp-session");
    });

    test("should handle alternative attribute names", () => {
      const dpAttributes = [
        { key: "session_id", value: { stringValue: "alt-session" } },
        { key: "user_id", value: { stringValue: "alt-user" } }
      ];
      const resourceAttributes = [];

      const result = extractSessionInfo(dpAttributes, resourceAttributes);

      expect(result.sessionId).toBe("alt-session");
      expect(result.userId).toBe("alt-user");
    });
  });

  describe("parseTokenMetric", () => {
    test("should parse input tokens", () => {
      const result = parseTokenMetric(150, "input");
      
      expect(result).toEqual({
        inputTokens: 150,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0
      });
    });

    test("should parse output tokens", () => {
      const result = parseTokenMetric(75, "output");
      
      expect(result).toEqual({
        inputTokens: 0,
        outputTokens: 75,
        cacheReadTokens: 0,
        cacheCreationTokens: 0
      });
    });

    test("should parse cache read tokens", () => {
      const result1 = parseTokenMetric(50, "cache_read");
      const result2 = parseTokenMetric(50, "cacheRead");
      
      const expected = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 50,
        cacheCreationTokens: 0
      };

      expect(result1).toEqual(expected);
      expect(result2).toEqual(expected);
    });

    test("should parse cache creation tokens", () => {
      const result1 = parseTokenMetric(25, "cache_creation");
      const result2 = parseTokenMetric(25, "cacheCreation");
      
      const expected = {
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 25
      };

      expect(result1).toEqual(expected);
      expect(result2).toEqual(expected);
    });

    test("should return zero for unknown token types", () => {
      const result = parseTokenMetric(100, "unknown");
      
      expect(result).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0
      });
    });
  });

  describe("parseMessageInfo", () => {
    test("should parse message information", () => {
      const attrs = {
        message_id: "msg-123",
        conversation_id: "conv-456",
        role: "user",
        model: "claude-3-sonnet"
      };

      const result = parseMessageInfo(attrs);

      expect(result).toEqual({
        messageId: "msg-123",
        conversationId: "conv-456",
        role: "user",
        model: "claude-3-sonnet"
      });
    });

    test("should handle alternative attribute names", () => {
      const attrs = {
        "message.id": "alt-msg-123",
        "conversation.id": "alt-conv-456",
        "message.role": "assistant",
        "message.model": "claude-3-opus"
      };

      const result = parseMessageInfo(attrs);

      expect(result).toEqual({
        messageId: "alt-msg-123",
        conversationId: "alt-conv-456",
        role: "assistant",
        model: "claude-3-opus"
      });
    });

    test("should handle missing attributes", () => {
      const attrs = {
        message_id: "msg-only"
      };

      const result = parseMessageInfo(attrs);

      expect(result).toEqual({
        messageId: "msg-only",
        conversationId: undefined,
        role: undefined,
        model: undefined
      });
    });
  });

  describe("getMetricType", () => {
    test("should return counter for monotonic sum metrics", () => {
      const metric = {
        sum: { isMonotonic: true }
      };

      expect(getMetricType(metric)).toBe("counter");
    });

    test("should return gauge for non-monotonic sum metrics", () => {
      const metric = {
        sum: { isMonotonic: false }
      };

      expect(getMetricType(metric)).toBe("gauge");
    });

    test("should return gauge for gauge metrics", () => {
      const metric = {
        gauge: {}
      };

      expect(getMetricType(metric)).toBe("gauge");
    });

    test("should return histogram for histogram metrics", () => {
      const metric = {
        histogram: {}
      };

      expect(getMetricType(metric)).toBe("histogram");
    });

    test("should return unknown for unrecognized metrics", () => {
      const metric = {
        unknown: {}
      };

      expect(getMetricType(metric)).toBe("unknown");
    });
  });

  describe("extractMetricValue", () => {
    test("should extract integer value", () => {
      const dataPoint = { asInt: 42 };
      expect(extractMetricValue(dataPoint)).toBe(42);
    });

    test("should extract double value", () => {
      const dataPoint = { asDouble: 3.14 };
      expect(extractMetricValue(dataPoint)).toBe(3.14);
    });

    test("should extract sum value", () => {
      const dataPoint = { sum: 100 };
      expect(extractMetricValue(dataPoint)).toBe(100);
    });

    test("should prioritize asInt over asDouble", () => {
      const dataPoint = { asInt: 42, asDouble: 3.14 };
      expect(extractMetricValue(dataPoint)).toBe(42);
    });

    test("should return 0 for missing values", () => {
      const dataPoint = {};
      expect(extractMetricValue(dataPoint)).toBe(0);
    });
  });

  describe("shouldProcessSession", () => {
    test("should return true for session-related metrics", () => {
      expect(shouldProcessSession("claude_code.cost.usage")).toBe(true);
      expect(shouldProcessSession("claude_code.token.usage")).toBe(true);
      expect(shouldProcessSession("conversation.message.cost")).toBe(true);
      expect(shouldProcessSession("conversation.message.tokens")).toBe(true);
    });

    test("should return false for non-session metrics", () => {
      expect(shouldProcessSession("http.request.duration")).toBe(false);
      expect(shouldProcessSession("system.memory.usage")).toBe(false);
      expect(shouldProcessSession("unknown.metric")).toBe(false);
    });
  });

  describe("isMessageMetric", () => {
    test("should return true for message-related metrics", () => {
      expect(isMessageMetric("conversation.message.cost")).toBe(true);
      expect(isMessageMetric("conversation.message.tokens")).toBe(true);
    });

    test("should return false for non-message metrics", () => {
      expect(isMessageMetric("claude_code.cost.usage")).toBe(false);
      expect(isMessageMetric("claude_code.token.usage")).toBe(false);
      expect(isMessageMetric("http.request.duration")).toBe(false);
    });
  });
});