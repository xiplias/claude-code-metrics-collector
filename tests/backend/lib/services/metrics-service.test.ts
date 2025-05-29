import { describe, it, expect } from "bun:test";
import { 
  validateMetricData,
  parseMetricData,
  getMetrics
} from "../../../../backend/lib/services/metrics-service";

describe("MetricsService", () => {
  describe("validateMetricData", () => {
    it("should validate required metric_name field", () => {
      const validData = { metric_name: "test.metric" };
      const invalidData = { metric_value: 123 };
      
      expect(validateMetricData(validData).isValid).toBe(true);
      expect(validateMetricData(invalidData).isValid).toBe(false);
      expect(validateMetricData(invalidData).error).toBe("metric_name is required");
    });

    it("should validate metric_value type if provided", () => {
      const validData = { metric_name: "test.metric", metric_value: 123 };
      const invalidData = { metric_name: "test.metric", metric_value: "not a number" };
      
      expect(validateMetricData(validData).isValid).toBe(true);
      expect(validateMetricData(invalidData).isValid).toBe(false);
      expect(validateMetricData(invalidData).error).toBe("metric_value must be a number");
    });

    it("should allow undefined metric_value", () => {
      const data = { metric_name: "test.metric" };
      
      expect(validateMetricData(data).isValid).toBe(true);
    });
  });

  describe("parseMetricData", () => {
    it("should parse all metric data fields", () => {
      const input = {
        metric_type: "counter",
        metric_name: "test.metric",
        metric_value: 42,
        labels: { environment: "test" },
        project_path: "/test/project",
        user_id: "user123",
        session_id: "session456",
        metadata: { version: "1.0.0" }
      };

      const result = parseMetricData(input);

      expect(result.metric_type).toBe("counter");
      expect(result.metric_name).toBe("test.metric");
      expect(result.metric_value).toBe(42);
      expect(result.labels).toEqual({ environment: "test" });
      expect(result.project_path).toBe("/test/project");
      expect(result.user_id).toBe("user123");
      expect(result.session_id).toBe("session456");
      expect(result.metadata).toEqual({ version: "1.0.0" });
    });

    it("should handle partial data", () => {
      const input = {
        metric_name: "minimal.metric"
      };

      const result = parseMetricData(input);

      expect(result.metric_name).toBe("minimal.metric");
      expect(result.metric_type).toBeUndefined();
      expect(result.metric_value).toBeUndefined();
      expect(result.labels).toBeUndefined();
    });
  });

  describe("getMetrics", () => {
    it("should return metrics with limit and offset", () => {
      const params = { limit: 10, offset: 0 };
      const metrics = getMetrics(params);
      
      expect(Array.isArray(metrics)).toBe(true);
      expect(metrics.length).toBeLessThanOrEqual(10);
      
      if (metrics.length > 0) {
        const firstMetric = metrics[0];
        expect(firstMetric).toHaveProperty("metric_name");
        expect(firstMetric).toHaveProperty("metric_value");
        expect(firstMetric).toHaveProperty("timestamp");
      }
    });

    it("should respect pagination parameters", () => {
      const page1 = getMetrics({ limit: 5, offset: 0 });
      const page2 = getMetrics({ limit: 5, offset: 5 });
      
      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);
      
      // If there are enough metrics, the pages should be different
      if (page1.length === 5 && page2.length > 0) {
        expect(page1[0]).not.toEqual(page2[0]);
      }
    });

    it("should return metrics in descending timestamp order", () => {
      const metrics = getMetrics({ limit: 10, offset: 0 });
      
      if (metrics.length > 1) {
        for (let i = 1; i < metrics.length; i++) {
          const prevTimestamp = new Date(metrics[i-1].timestamp);
          const currTimestamp = new Date(metrics[i].timestamp);
          expect(prevTimestamp.getTime()).toBeGreaterThanOrEqual(currTimestamp.getTime());
        }
      }
    });
  });
});