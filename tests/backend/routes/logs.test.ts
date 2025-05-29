import { describe, it, expect, beforeEach, mock } from "bun:test";
import { handleGetLogs } from "../../../backend/routes/logs";

// Mock the logs service
const mockGetLogs = mock();
const mockGetLogsCount = mock();
const mockParseLogsParams = mock();

mock.module("../../../backend/lib/services/logs-service", () => ({
  getLogs: mockGetLogs,
  getLogsCount: mockGetLogsCount,
  parseLogsParams: mockParseLogsParams
}));

describe("Logs Route", () => {
  beforeEach(() => {
    mockGetLogs.mockClear();
    mockGetLogsCount.mockClear();
    mockParseLogsParams.mockClear();
  });

  describe("handleGetLogs", () => {
    it("should return logs with total count", async () => {
      const mockParams = { limit: 50, offset: 0 };
      const mockLogs = [
        { id: 1, endpoint: "/metrics", method: "POST", response_status: 200 },
        { id: 2, endpoint: "/v1/metrics", method: "POST", response_status: 200 }
      ];
      const mockTotalCount = 150;
      
      mockParseLogsParams.mockReturnValue(mockParams);
      mockGetLogs.mockReturnValue(mockLogs);
      mockGetLogsCount.mockReturnValue(mockTotalCount);
      
      const mockRequest = new Request("http://localhost:3000/api/logs?limit=50&offset=0");
      
      const response = await handleGetLogs(mockRequest);
      
      expect(response.status).toBe(200);
      
      // Verify service calls
      expect(mockParseLogsParams).toHaveBeenCalledWith(expect.any(URL));
      expect(mockGetLogs).toHaveBeenCalledWith(mockParams);
      expect(mockGetLogsCount).toHaveBeenCalledTimes(1);
      
      const body = await response.json();
      expect(body).toEqual({
        logs: mockLogs,
        totalCount: mockTotalCount
      });
    });

    it("should handle different URL parameters", async () => {
      const mockParams = { limit: 25, offset: 50, endpoint: "/metrics" };
      const mockLogs = [];
      const mockTotalCount = 0;
      
      mockParseLogsParams.mockReturnValue(mockParams);
      mockGetLogs.mockReturnValue(mockLogs);
      mockGetLogsCount.mockReturnValue(mockTotalCount);
      
      const mockRequest = new Request("http://localhost:3000/api/logs?limit=25&offset=50&endpoint=/metrics");
      
      const response = await handleGetLogs(mockRequest);
      
      expect(response.status).toBe(200);
      
      // Verify the URL was passed to parseLogsParams
      expect(mockParseLogsParams).toHaveBeenCalledWith(expect.any(URL));
      const calledUrl = mockParseLogsParams.mock.calls[0][0];
      expect(calledUrl.searchParams.get("limit")).toBe("25");
      expect(calledUrl.searchParams.get("offset")).toBe("50");
      expect(calledUrl.searchParams.get("endpoint")).toBe("/metrics");
    });

    it("should include CORS headers", async () => {
      const mockParams = { limit: 100, offset: 0 };
      
      mockParseLogsParams.mockReturnValue(mockParams);
      mockGetLogs.mockReturnValue([]);
      mockGetLogsCount.mockReturnValue(0);
      
      const mockRequest = new Request("http://localhost:3000/api/logs");
      
      const response = await handleGetLogs(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Service");
    });

    it("should handle service errors gracefully", async () => {
      mockParseLogsParams.mockImplementation(() => {
        throw new Error("Invalid parameters");
      });
      
      const mockRequest = new Request("http://localhost:3000/api/logs");
      
      // The route doesn't currently handle errors, so this will throw
      // In a real implementation, we might want to add error handling
      await expect(async () => {
        await handleGetLogs(mockRequest);
      }).toThrow("Invalid parameters");
    });

    it("should work with empty query parameters", async () => {
      const mockParams = { limit: 100, offset: 0 };
      const mockLogs = [];
      const mockTotalCount = 0;
      
      mockParseLogsParams.mockReturnValue(mockParams);
      mockGetLogs.mockReturnValue(mockLogs);
      mockGetLogsCount.mockReturnValue(mockTotalCount);
      
      const mockRequest = new Request("http://localhost:3000/api/logs");
      
      const response = await handleGetLogs(mockRequest);
      
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body).toEqual({
        logs: [],
        totalCount: 0
      });
    });
  });
});