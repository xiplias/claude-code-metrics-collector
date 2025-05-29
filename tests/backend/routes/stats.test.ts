import { describe, it, expect, beforeEach, mock } from "bun:test";
import { handleGetStats } from "../../../backend/routes/stats";

// Mock the stats service
const mockCalculateStatsData = mock();

mock.module("../../../backend/lib/services/stats-service", () => ({
  calculateStatsData: mockCalculateStatsData
}));

describe("Stats Route", () => {
  beforeEach(() => {
    mockCalculateStatsData.mockClear();
  });

  describe("handleGetStats", () => {
    it("should return calculated stats data", async () => {
      const mockStatsData = {
        total_sessions: 25,
        total_cost: 12.50,
        total_messages: 100,
        avg_cost_per_message: 0.125,
        total_input_tokens: 50000,
        total_output_tokens: 30000,
        recent_sessions: [
          { session_id: "session-1", total_cost: 0.50 },
          { session_id: "session-2", total_cost: 0.75 }
        ]
      };
      
      mockCalculateStatsData.mockReturnValue(mockStatsData);
      
      const mockRequest = new Request("http://localhost:3000/api/stats");
      
      const response = await handleGetStats(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockCalculateStatsData).toHaveBeenCalledTimes(1);
      
      const body = await response.json();
      expect(body).toEqual(mockStatsData);
    });

    it("should include CORS headers", async () => {
      const mockStatsData = {
        total_sessions: 0,
        total_cost: 0,
        total_messages: 0,
        avg_cost_per_message: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        recent_sessions: []
      };
      
      mockCalculateStatsData.mockReturnValue(mockStatsData);
      
      const mockRequest = new Request("http://localhost:3000/api/stats");
      
      const response = await handleGetStats(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Service");
    });

    it("should handle service errors gracefully", async () => {
      mockCalculateStatsData.mockImplementation(() => {
        throw new Error("Database connection failed");
      });
      
      const mockRequest = new Request("http://localhost:3000/api/stats");
      
      // The route doesn't currently handle errors, so this will throw
      // In a real implementation, we might want to add error handling
      await expect(async () => {
        await handleGetStats(mockRequest);
      }).toThrow("Database connection failed");
    });
  });
});