import { describe, it, expect } from "bun:test";
import { handleGetHealth } from "../../../backend/routes/health";

describe("Health Route", () => {
  describe("handleGetHealth", () => {
    it("should return 200 with service status", async () => {
      const mockRequest = new Request("http://localhost:3000/health");
      
      const response = await handleGetHealth(mockRequest);
      
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toEqual({
        status: "ok",
        service: "claude-metrics-server",
        timestamp: expect.any(String),
        endpoints: {
          metrics: "/metrics",
          events: "/events",
          stats: "/stats",
          otlp: "/v1/metrics",
        }
      });
    });

    it("should include correct response headers", async () => {
      const mockRequest = new Request("http://localhost:3000/health");
      
      const response = await handleGetHealth(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Service");
    });

    it("should return valid timestamp", async () => {
      const mockRequest = new Request("http://localhost:3000/health");
      
      const response = await handleGetHealth(mockRequest);
      const body = await response.json();
      
      expect(new Date(body.timestamp)).toBeInstanceOf(Date);
      expect(body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});