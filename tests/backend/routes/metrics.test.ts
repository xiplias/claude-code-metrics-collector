import { describe, it, expect, beforeEach, mock } from "bun:test";
import { handlePostMetrics, handleGetMetrics, handlePostV1Metrics } from "../../../backend/routes/metrics";

// Mock the metrics service
const mockRecordMetric = mock();
const mockGetMetrics = mock();
const mockValidateMetricData = mock();
const mockParseMetricData = mock();

// Mock the OTLP service
const mockValidateOTLPContentType = mock();
const mockParseOTLPData = mock();
const mockProcessOTLPData = mock();

// Mock the OTLP helpers
const mockExtractOTLPData = mock();

// Mock the utils
const mockLogRequest = mock();

mock.module("../../../backend/lib/services/metrics-service", () => ({
  recordMetric: mockRecordMetric,
  getMetrics: mockGetMetrics,
  validateMetricData: mockValidateMetricData,
  parseMetricData: mockParseMetricData
}));

mock.module("../../../backend/lib/services/otlp-service", () => ({
  validateOTLPContentType: mockValidateOTLPContentType,
  parseOTLPData: mockParseOTLPData,
  processOTLPData: mockProcessOTLPData
}));

mock.module("../../../backend/lib/otlp-helpers", () => ({
  extractOTLPData: mockExtractOTLPData
}));

mock.module("../../../backend/lib/utils", () => ({
  corsHeaders: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Service"
  },
  logRequest: mockLogRequest
}));

describe("Metrics Route", () => {
  beforeEach(() => {
    mockRecordMetric.mockClear();
    mockGetMetrics.mockClear();
    mockValidateMetricData.mockClear();
    mockParseMetricData.mockClear();
    mockValidateOTLPContentType.mockClear();
    mockParseOTLPData.mockClear();
    mockProcessOTLPData.mockClear();
    mockExtractOTLPData.mockClear();
    mockLogRequest.mockClear();
  });

  describe("handlePostMetrics", () => {
    it("should successfully record a valid metric", async () => {
      const metricData = {
        name: "test.metric",
        value: 42,
        timestamp: Date.now()
      };
      
      const parsedMetricData = {
        ...metricData,
        tags: { service: "test" }
      };
      
      mockValidateMetricData.mockReturnValue({ isValid: true });
      mockParseMetricData.mockReturnValue(parsedMetricData);
      
      const mockRequest = new Request("http://localhost:3000/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metricData)
      });
      
      const response = await handlePostMetrics(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockValidateMetricData).toHaveBeenCalledWith(metricData);
      expect(mockParseMetricData).toHaveBeenCalledWith(metricData);
      expect(mockRecordMetric).toHaveBeenCalledWith(parsedMetricData);
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/metrics",
        200,
        expect.any(Number),
        undefined,
        JSON.stringify(metricData)
      );
      
      const body = await response.json();
      expect(body).toEqual({
        success: true,
        message: "Metric recorded"
      });
    });

    it("should return 400 for invalid metric data", async () => {
      const invalidMetricData = {
        invalid: "data"
      };
      
      mockValidateMetricData.mockReturnValue({ 
        isValid: false,
        error: "Missing required field: name" 
      });
      
      const mockRequest = new Request("http://localhost:3000/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidMetricData)
      });
      
      const response = await handlePostMetrics(mockRequest);
      
      expect(response.status).toBe(400);
      expect(mockValidateMetricData).toHaveBeenCalledWith(invalidMetricData);
      expect(mockParseMetricData).not.toHaveBeenCalled();
      expect(mockRecordMetric).not.toHaveBeenCalled();
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/metrics",
        400,
        expect.any(Number),
        "Missing required field: name",
        JSON.stringify(invalidMetricData)
      );
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Missing required field: name"
      });
    });

    it("should handle JSON parsing errors", async () => {
      const mockRequest = new Request("http://localhost:3000/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json"
      });
      
      const response = await handlePostMetrics(mockRequest);
      
      expect(response.status).toBe(500);
      expect(mockValidateMetricData).not.toHaveBeenCalled();
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/metrics",
        500,
        expect.any(Number),
        expect.stringContaining("JSON"),
        undefined
      );
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Failed to record metric",
        message: expect.stringContaining("JSON")
      });
    });

    it("should handle errors during metric recording", async () => {
      const metricData = {
        name: "test.metric",
        value: 42
      };
      
      mockValidateMetricData.mockReturnValue({ isValid: true });
      mockParseMetricData.mockReturnValue(metricData);
      mockRecordMetric.mockImplementation(() => {
        throw new Error("Database error");
      });
      
      const mockRequest = new Request("http://localhost:3000/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metricData)
      });
      
      const response = await handlePostMetrics(mockRequest);
      
      expect(response.status).toBe(500);
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/metrics",
        500,
        expect.any(Number),
        "Database error",
        JSON.stringify(metricData)
      );
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Failed to record metric",
        message: "Database error"
      });
    });

    it("should include CORS headers in response", async () => {
      mockValidateMetricData.mockReturnValue({ isValid: true });
      mockParseMetricData.mockReturnValue({ name: "test", value: 1 });
      
      const mockRequest = new Request("http://localhost:3000/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "test", value: 1 })
      });
      
      const response = await handlePostMetrics(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Service");
    });
  });

  describe("handleGetMetrics", () => {
    it("should return metrics with default pagination", async () => {
      const mockMetricsData = [
        { id: 1, name: "metric1", value: 10, timestamp: Date.now() },
        { id: 2, name: "metric2", value: 20, timestamp: Date.now() }
      ];
      
      mockGetMetrics.mockReturnValue(mockMetricsData);
      
      const mockRequest = new Request("http://localhost:3000/api/metrics");
      
      const response = await handleGetMetrics(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockGetMetrics).toHaveBeenCalledWith({ limit: 100, offset: 0 });
      
      const body = await response.json();
      expect(body).toEqual({ metrics: mockMetricsData });
    });

    it("should handle custom pagination parameters", async () => {
      const mockMetricsData = [
        { id: 3, name: "metric3", value: 30, timestamp: Date.now() }
      ];
      
      mockGetMetrics.mockReturnValue(mockMetricsData);
      
      const mockRequest = new Request("http://localhost:3000/api/metrics?limit=50&offset=100");
      
      const response = await handleGetMetrics(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockGetMetrics).toHaveBeenCalledWith({ limit: 50, offset: 100 });
      
      const body = await response.json();
      expect(body).toEqual({ metrics: mockMetricsData });
    });

    it("should handle invalid pagination parameters", async () => {
      const mockMetricsData = [];
      mockGetMetrics.mockReturnValue(mockMetricsData);
      
      const mockRequest = new Request("http://localhost:3000/api/metrics?limit=invalid&offset=abc");
      
      const response = await handleGetMetrics(mockRequest);
      
      expect(response.status).toBe(200);
      // parseInt returns NaN for invalid values
      expect(mockGetMetrics).toHaveBeenCalledWith({ limit: NaN, offset: NaN });
      
      const body = await response.json();
      expect(body).toEqual({ metrics: mockMetricsData });
    });

    it("should include CORS headers in response", async () => {
      mockGetMetrics.mockReturnValue([]);
      
      const mockRequest = new Request("http://localhost:3000/api/metrics");
      
      const response = await handleGetMetrics(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Service");
    });
  });

  describe("handlePostV1Metrics", () => {
    it("should successfully process OTLP metrics", async () => {
      const otlpData = {
        resourceMetrics: [{
          resource: { attributes: [] },
          scopeMetrics: [{
            metrics: [{
              name: "test.metric",
              gauge: { dataPoints: [{ asDouble: 42 }] }
            }]
          }]
        }]
      };
      
      const extractedData = {
        sessionId: "test-session",
        model: "claude-3.5-sonnet",
        totalCost: 0.05
      };
      
      mockValidateOTLPContentType.mockReturnValue({ isValid: true });
      mockParseOTLPData.mockResolvedValue(otlpData);
      mockExtractOTLPData.mockReturnValue(extractedData);
      mockProcessOTLPData.mockReturnValue({ success: true });
      
      const mockRequest = new Request("http://localhost:3000/v1/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/x-protobuf" },
        body: "protobuf-data"
      });
      
      const response = await handlePostV1Metrics(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockValidateOTLPContentType).toHaveBeenCalledWith("application/x-protobuf");
      expect(mockParseOTLPData).toHaveBeenCalledWith(mockRequest);
      expect(mockExtractOTLPData).toHaveBeenCalledWith(otlpData);
      expect(mockProcessOTLPData).toHaveBeenCalledWith(otlpData);
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/v1/metrics",
        200,
        expect.any(Number),
        undefined,
        JSON.stringify(otlpData),
        extractedData
      );
      
      // OTLP expects empty response
      const body = await response.text();
      expect(body).toBe("");
    });

    it("should return 400 for invalid content type", async () => {
      mockValidateOTLPContentType.mockReturnValue({ 
        isValid: false,
        error: "Invalid content type" 
      });
      
      const mockRequest = new Request("http://localhost:3000/v1/metrics", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "some data"
      });
      
      const response = await handlePostV1Metrics(mockRequest);
      
      expect(response.status).toBe(400);
      expect(mockValidateOTLPContentType).toHaveBeenCalledWith("text/plain");
      expect(mockParseOTLPData).not.toHaveBeenCalled();
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/v1/metrics",
        400,
        expect.any(Number),
        "Invalid content type"
      );
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Invalid content type"
      });
    });

    it("should handle OTLP processing errors", async () => {
      const otlpData = {
        resourceMetrics: []
      };
      
      mockValidateOTLPContentType.mockReturnValue({ isValid: true });
      mockParseOTLPData.mockResolvedValue(otlpData);
      mockExtractOTLPData.mockReturnValue({});
      mockProcessOTLPData.mockReturnValue({ 
        success: false, 
        error: "Failed to extract session data" 
      });
      
      const mockRequest = new Request("http://localhost:3000/v1/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/x-protobuf" },
        body: "protobuf-data"
      });
      
      const response = await handlePostV1Metrics(mockRequest);
      
      expect(response.status).toBe(500);
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/v1/metrics",
        500,
        expect.any(Number),
        "Failed to extract session data",
        JSON.stringify(otlpData),
        {}
      );
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Failed to process OTLP metrics",
        message: "Failed to extract session data"
      });
    });

    it("should handle parsing errors", async () => {
      mockValidateOTLPContentType.mockReturnValue({ isValid: true });
      mockParseOTLPData.mockRejectedValue(new Error("Parse error"));
      
      const mockRequest = new Request("http://localhost:3000/v1/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/x-protobuf" },
        body: "invalid-data"
      });
      
      const response = await handlePostV1Metrics(mockRequest);
      
      expect(response.status).toBe(500);
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/v1/metrics",
        500,
        expect.any(Number),
        "Parse error",
        undefined
      );
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Failed to process OTLP metrics",
        message: "Parse error"
      });
    });

    it("should handle missing content type header", async () => {
      mockValidateOTLPContentType.mockReturnValue({ 
        isValid: false,
        error: "Content-Type header is required" 
      });
      
      const mockRequest = new Request("http://localhost:3000/v1/metrics", {
        method: "POST",
        body: "some data"
      });
      
      const response = await handlePostV1Metrics(mockRequest);
      
      expect(response.status).toBe(400);
      expect(mockValidateOTLPContentType).toHaveBeenCalledWith("");
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Content-Type header is required"
      });
    });

    it("should include CORS headers in all responses", async () => {
      mockValidateOTLPContentType.mockReturnValue({ isValid: true });
      mockParseOTLPData.mockResolvedValue({});
      mockExtractOTLPData.mockReturnValue({});
      mockProcessOTLPData.mockReturnValue({ success: true });
      
      const mockRequest = new Request("http://localhost:3000/v1/metrics", {
        method: "POST",
        headers: { "Content-Type": "application/x-protobuf" },
        body: "data"
      });
      
      const response = await handlePostV1Metrics(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Service");
    });
  });
});