import { describe, it, expect, beforeEach } from "bun:test";
import { 
  extractDataPointValue, 
  getMetricType, 
  extractDataPoints, 
  processDataPoint, 
  storeRawMetric, 
  processSessionCostMetric, 
  processSessionTokenMetric, 
  processMessageCostMetric, 
  processMessageTokenMetric, 
  processMetricDataPoint 
} from "../../../backend/lib/metric-processor-test";
import { createMessageData } from "../../../backend/lib/message-processor-test";
import { SessionData } from "../../../backend/lib/session-processor-test";
import { testDb } from "../../../backend/lib/test-database";

describe("Metric Processor", () => {
  beforeEach(() => {
    // Clean up test data
    testDb.exec("DELETE FROM metrics WHERE session_id LIKE 'test-session-%'");
  });

  describe("extractDataPointValue", () => {
    it("should extract integer value", () => {
      const dataPoint = { asInt: "123" };
      const value = extractDataPointValue(dataPoint);
      expect(value).toBe(123);
    });

    it("should extract double value", () => {
      const dataPoint = { asDouble: 45.67 };
      const value = extractDataPointValue(dataPoint);
      expect(value).toBe(45.67);
    });

    it("should prioritize asInt over asDouble", () => {
      const dataPoint = { asInt: "100", asDouble: 200.5 };
      const value = extractDataPointValue(dataPoint);
      expect(value).toBe(100);
    });

    it("should return 0 for missing values", () => {
      const dataPoint = {};
      const value = extractDataPointValue(dataPoint);
      expect(value).toBe(0);
    });
  });

  describe("getMetricType", () => {
    it("should return counter for monotonic sum metrics", () => {
      const metric = { sum: { isMonotonic: true } };
      const type = getMetricType(metric);
      expect(type).toBe("counter");
    });

    it("should return gauge for non-monotonic sum metrics", () => {
      const metric = { sum: { isMonotonic: false } };
      const type = getMetricType(metric);
      expect(type).toBe("gauge");
    });

    it("should return gauge for gauge metrics", () => {
      const metric = { gauge: {} };
      const type = getMetricType(metric);
      expect(type).toBe("gauge");
    });

    it("should return histogram for histogram metrics", () => {
      const metric = { histogram: {} };
      const type = getMetricType(metric);
      expect(type).toBe("histogram");
    });

    it("should return unknown for unrecognized metrics", () => {
      const metric = { unknown: {} };
      const type = getMetricType(metric);
      expect(type).toBe("unknown");
    });
  });

  describe("extractDataPoints", () => {
    it("should extract data points from sum metrics", () => {
      const metric = {
        sum: {
          dataPoints: [{ asDouble: 1 }, { asDouble: 2 }]
        }
      };
      const dataPoints = extractDataPoints(metric);
      expect(dataPoints).toHaveLength(2);
      expect(dataPoints[0].asDouble).toBe(1);
    });

    it("should extract data points from gauge metrics", () => {
      const metric = {
        gauge: {
          dataPoints: [{ asDouble: 3 }]
        }
      };
      const dataPoints = extractDataPoints(metric);
      expect(dataPoints).toHaveLength(1);
      expect(dataPoints[0].asDouble).toBe(3);
    });

    it("should extract data points from histogram metrics", () => {
      const metric = {
        histogram: {
          dataPoints: [{ sum: 4 }]
        }
      };
      const dataPoints = extractDataPoints(metric);
      expect(dataPoints).toHaveLength(1);
      expect(dataPoints[0].sum).toBe(4);
    });

    it("should return empty array for unknown metric types", () => {
      const metric = { unknown: {} };
      const dataPoints = extractDataPoints(metric);
      expect(dataPoints).toHaveLength(0);
    });
  });

  describe("processDataPoint", () => {
    it("should process data point and extract info", () => {
      const dataPoint = {
        asDouble: 0.15,
        timeUnixNano: "1748530951000000000",
        attributes: [
          { key: "session.id", value: { stringValue: "test-session-001" } },
          { key: "user.id", value: { stringValue: "test-user-001" } }
        ]
      };

      const info = processDataPoint(dataPoint);
      
      expect(info.value).toBe(0.15);
      expect(info.timestamp).toBe("1748530951000000000");
      expect(info.attributes["session.id"]).toBe("test-session-001");
      expect(info.attributes["user.id"]).toBe("test-user-001");
    });

    it("should handle missing timestamp", () => {
      const dataPoint = { asDouble: 0.1 };
      const info = processDataPoint(dataPoint);
      
      expect(info.value).toBe(0.1);
      expect(info.timestamp).toMatch(/^\d+$/);
    });
  });

  describe("storeRawMetric", () => {
    it("should store metric in database", () => {
      const dataPointInfo = {
        value: 0.08,
        attributes: { "type": "input" },
        timestamp: "1748530951000000000"
      };

      const resourceAttrs = {
        "service.name": "claude-code",
        "service.version": "1.0.5"
      };

      const sessionData: SessionData = {
        sessionId: "test-session-metric-001",
        userId: "test-user-metric-001",
        userEmail: "metric@example.com",
        orgId: "test-org-metric-001",
        model: "claude-3-sonnet"
      };

      storeRawMetric("test.metric", "counter", dataPointInfo, resourceAttrs, sessionData);

      const metrics = testDb.query("SELECT * FROM metrics WHERE metric_name = ?")
        .all("test.metric");
      expect(metrics).toHaveLength(1);
      expect(metrics[0].metric_value).toBe(0.08);
      expect(metrics[0].session_id).toBe("test-session-metric-001");
    });
  });

  describe("processSessionCostMetric", () => {
    it("should add cost to message data", () => {
      const messageData = createMessageData();
      const dataPointInfo = { value: 0.12, attributes: {}, timestamp: "123" };

      processSessionCostMetric(dataPointInfo, messageData);
      
      expect(messageData.totalCost).toBe(0.12);
    });
  });

  describe("processSessionTokenMetric", () => {
    it("should add tokens to message data", () => {
      const messageData = createMessageData();
      const dataPointInfo = { 
        value: 500, 
        attributes: { "type": "input" }, 
        timestamp: "123" 
      };

      processSessionTokenMetric(dataPointInfo, messageData);
      
      expect(messageData.inputTokens).toBe(500);
    });

    it("should handle missing token type", () => {
      const messageData = createMessageData();
      const dataPointInfo = { value: 500, attributes: {}, timestamp: "123" };

      processSessionTokenMetric(dataPointInfo, messageData);
      
      expect(messageData.inputTokens).toBe(0);
      expect(messageData.outputTokens).toBe(0);
    });
  });

  describe("processMessageCostMetric", () => {
    it("should add cost and extract message info", () => {
      const messageData = createMessageData();
      const dataPointInfo = { 
        value: 0.06, 
        attributes: { 
          "message_id": "test-msg-001",
          "role": "assistant" 
        }, 
        timestamp: "123" 
      };

      processMessageCostMetric(dataPointInfo, messageData);
      
      expect(messageData.totalCost).toBe(0.06);
      expect(messageData.messageId).toBe("test-msg-001");
      expect(messageData.role).toBe("assistant");
    });
  });

  describe("processMessageTokenMetric", () => {
    it("should add tokens and extract message info", () => {
      const messageData = createMessageData();
      const dataPointInfo = { 
        value: 800, 
        attributes: { 
          "type": "output",
          "message_id": "test-msg-002"
        }, 
        timestamp: "123" 
      };

      processMessageTokenMetric(dataPointInfo, messageData);
      
      expect(messageData.outputTokens).toBe(800);
      expect(messageData.messageId).toBe("test-msg-002");
    });

    it("should handle alternative token type attribute", () => {
      const messageData = createMessageData();
      const dataPointInfo = { 
        value: 600, 
        attributes: { 
          "token.type": "cache_read"
        }, 
        timestamp: "123" 
      };

      processMessageTokenMetric(dataPointInfo, messageData);
      
      expect(messageData.cacheReadTokens).toBe(600);
    });
  });

  describe("processMetricDataPoint", () => {
    it("should process claude_code.cost.usage metric", () => {
      const messageData = createMessageData();
      const sessionData: SessionData = {
        sessionId: "test-session-001",
        userId: "test-user-001",
        userEmail: null,
        orgId: null,
        model: null
      };

      const dataPointInfo = { value: 0.15, attributes: {}, timestamp: "123" };

      const updatedSession = processMetricDataPoint(
        "claude_code.cost.usage", 
        dataPointInfo, 
        messageData, 
        sessionData
      );
      
      expect(messageData.totalCost).toBe(0.15);
      expect(updatedSession.sessionId).toBe("test-session-001");
    });

    it("should update session data from data point attributes", () => {
      const messageData = createMessageData();
      const sessionData: SessionData = {
        sessionId: null,
        userId: null,
        userEmail: null,
        orgId: null,
        model: null
      };

      const dataPointInfo = { 
        value: 0.1, 
        attributes: {
          "session.id": "dp-session-001",
          "user.id": "dp-user-001",
          "model": "dp-model"
        }, 
        timestamp: "123" 
      };

      const updatedSession = processMetricDataPoint(
        "claude_code.cost.usage", 
        dataPointInfo, 
        messageData, 
        sessionData
      );
      
      expect(updatedSession.sessionId).toBe("dp-session-001");
      expect(updatedSession.userId).toBe("dp-user-001");
      expect(updatedSession.model).toBe("dp-model");
    });

    it("should not overwrite existing session data", () => {
      const messageData = createMessageData();
      const sessionData: SessionData = {
        sessionId: "existing-session",
        userId: "existing-user",
        userEmail: "existing@example.com",
        orgId: "existing-org",
        model: "existing-model"
      };

      const dataPointInfo = { 
        value: 0.1, 
        attributes: {
          "session.id": "new-session",
          "user.id": "new-user"
        }, 
        timestamp: "123" 
      };

      const updatedSession = processMetricDataPoint(
        "claude_code.cost.usage", 
        dataPointInfo, 
        messageData, 
        sessionData
      );
      
      expect(updatedSession.sessionId).toBe("existing-session");
      expect(updatedSession.userId).toBe("existing-user");
    });

    it("should handle unknown metric types gracefully", () => {
      const messageData = createMessageData();
      const sessionData: SessionData = {
        sessionId: "test-session-001",
        userId: "test-user-001",
        userEmail: null,
        orgId: null,
        model: null
      };

      const dataPointInfo = { value: 123, attributes: {}, timestamp: "123" };

      const updatedSession = processMetricDataPoint(
        "unknown.metric.type", 
        dataPointInfo, 
        messageData, 
        sessionData
      );
      
      // Should not affect message data
      expect(messageData.totalCost).toBe(0);
      expect(messageData.inputTokens).toBe(0);
      
      // Should return updated session data
      expect(updatedSession.sessionId).toBe("test-session-001");
    });
  });
});