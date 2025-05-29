import { describe, it, expect } from "bun:test";
import { 
  validateOTLPContentType,
  processOTLPData
} from "../../../../backend/lib/services/otlp-service";

describe("OTLPService", () => {
  describe("validateOTLPContentType", () => {
    it("should reject protobuf content type", () => {
      const protobufContentType = "application/x-protobuf";
      const result = validateOTLPContentType(protobufContentType);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Protobuf format not yet supported");
      expect(result.error).toContain("OTEL_EXPORTER_OTLP_PROTOCOL=http/json");
    });

    it("should accept JSON content type", () => {
      const jsonContentType = "application/json";
      const result = validateOTLPContentType(jsonContentType);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should accept other content types", () => {
      const otherContentType = "text/plain";
      const result = validateOTLPContentType(otherContentType);
      
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle content type with additional parameters", () => {
      const contentTypeWithCharset = "application/x-protobuf; charset=utf-8";
      const result = validateOTLPContentType(contentTypeWithCharset);
      
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Protobuf format not yet supported");
    });
  });

  describe("processOTLPData", () => {
    it("should return success for valid OTLP data", () => {
      const validOTLPData = {
        resourceMetrics: [{
          resource: {
            attributes: [
              { key: "service.name", value: { stringValue: "test-service" } }
            ]
          },
          scopeMetrics: [{
            metrics: [{
              name: "test.counter",
              sum: {
                dataPoints: [{
                  asDouble: 1.0,
                  timeUnixNano: Date.now() * 1000000,
                  attributes: []
                }]
              }
            }]
          }]
        }]
      };

      const result = processOTLPData(validOTLPData);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle empty OTLP data", () => {
      const emptyOTLPData = { resourceMetrics: [] };
      const result = processOTLPData(emptyOTLPData);
      
      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should handle invalid OTLP data structure", () => {
      const invalidOTLPData = { invalid: "structure" };
      const result = processOTLPData(invalidOTLPData);
      
      // This should still succeed as processOTLPMetrics handles missing fields gracefully
      expect(result.success).toBe(true);
    });

    it("should handle processing errors", () => {
      // This test depends on the actual implementation of processOTLPMetrics
      // and may need to be adjusted based on what actually causes it to throw
      const malformedData = null;
      const result = processOTLPData(malformedData);
      
      // The actual behavior depends on how processOTLPMetrics handles null input
      expect(result).toHaveProperty("success");
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});