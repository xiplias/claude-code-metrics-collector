import { describe, test, expect } from "bun:test";
import { extractAttributes, corsHeaders } from "../../../backend/lib/utils";

describe("Backend Utils", () => {
  describe("extractAttributes", () => {
    test("should extract string values", () => {
      const attributes = [
        {
          key: "session.id",
          value: { stringValue: "test-session-123" }
        },
        {
          key: "user.email",
          value: { stringValue: "test@example.com" }
        }
      ];

      const result = extractAttributes(attributes);

      expect(result).toEqual({
        "session.id": "test-session-123",
        "user.email": "test@example.com"
      });
    });

    test("should extract integer values", () => {
      const attributes = [
        {
          key: "message.tokens",
          value: { intValue: 150 }
        },
        {
          key: "cost.cents",
          value: { intValue: 25 }
        }
      ];

      const result = extractAttributes(attributes);

      expect(result).toEqual({
        "message.tokens": 150,
        "cost.cents": 25
      });
    });

    test("should extract double values", () => {
      const attributes = [
        {
          key: "cost.usd",
          value: { doubleValue: 0.25 }
        },
        {
          key: "duration.seconds",
          value: { doubleValue: 1.5 }
        }
      ];

      const result = extractAttributes(attributes);

      expect(result).toEqual({
        "cost.usd": 0.25,
        "duration.seconds": 1.5
      });
    });

    test("should extract boolean values", () => {
      const attributes = [
        {
          key: "is.cached",
          value: { boolValue: true }
        },
        {
          key: "has.error",
          value: { boolValue: false }
        }
      ];

      const result = extractAttributes(attributes);

      expect(result).toEqual({
        "is.cached": true,
        "has.error": false
      });
    });

    test("should handle mixed value types", () => {
      const attributes = [
        {
          key: "session.id",
          value: { stringValue: "session-123" }
        },
        {
          key: "token.count",
          value: { intValue: 100 }
        },
        {
          key: "cost",
          value: { doubleValue: 0.15 }
        },
        {
          key: "is.cached",
          value: { boolValue: true }
        }
      ];

      const result = extractAttributes(attributes);

      expect(result).toEqual({
        "session.id": "session-123",
        "token.count": 100,
        "cost": 0.15,
        "is.cached": true
      });
    });

    test("should handle empty array", () => {
      const result = extractAttributes([]);
      expect(result).toEqual({});
    });

    test("should handle null/undefined input", () => {
      const result1 = extractAttributes(null as any);
      const result2 = extractAttributes(undefined as any);
      expect(result1).toEqual({});
      expect(result2).toEqual({});
    });

    test("should skip attributes with missing keys or values", () => {
      const attributes = [
        {
          key: "valid.key",
          value: { stringValue: "valid-value" }
        },
        {
          key: "",
          value: { stringValue: "empty-key" }
        },
        {
          key: "missing.value"
        },
        {
          key: "undefined.value",
          value: { stringValue: undefined }
        }
      ];

      const result = extractAttributes(attributes);

      expect(result).toEqual({
        "valid.key": "valid-value"
      });
    });
  });

  describe("corsHeaders", () => {
    test("should have correct CORS headers", () => {
      expect(corsHeaders).toEqual({
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-Service",
      });
    });
  });
});