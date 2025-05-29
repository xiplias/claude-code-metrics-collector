import { describe, it, expect, beforeEach, mock } from "bun:test";
import { handleGetSessions, handleGetSessionById } from "../../../backend/routes/sessions";

// Mock the sessions service
const mockGetSessions = mock();
const mockGetSessionDetails = mock();

mock.module("../../../backend/lib/services/sessions-service", () => ({
  getSessions: mockGetSessions,
  getSessionDetails: mockGetSessionDetails
}));

describe("Sessions Route", () => {
  beforeEach(() => {
    mockGetSessions.mockClear();
    mockGetSessionDetails.mockClear();
  });

  describe("handleGetSessions", () => {
    it("should return sessions with default pagination", async () => {
      const mockSessions = [
        { id: 1, session_id: "session-1", total_cost: 0.10 },
        { id: 2, session_id: "session-2", total_cost: 0.20 }
      ];
      
      mockGetSessions.mockReturnValue(mockSessions);
      
      const mockRequest = new Request("http://localhost:3000/api/sessions");
      
      const response = await handleGetSessions(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockGetSessions).toHaveBeenCalledWith({ limit: 100, offset: 0 });
      
      const body = await response.json();
      expect(body).toEqual({ sessions: mockSessions });
    });

    it("should handle custom pagination parameters", async () => {
      const mockSessions = [{ id: 3, session_id: "session-3", total_cost: 0.30 }];
      
      mockGetSessions.mockReturnValue(mockSessions);
      
      const mockRequest = new Request("http://localhost:3000/api/sessions?limit=50&offset=10");
      
      const response = await handleGetSessions(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockGetSessions).toHaveBeenCalledWith({ limit: 50, offset: 10 });
      
      const body = await response.json();
      expect(body).toEqual({ sessions: mockSessions });
    });

    it("should handle invalid pagination parameters gracefully", async () => {
      const mockSessions = [];
      
      mockGetSessions.mockReturnValue(mockSessions);
      
      const mockRequest = new Request("http://localhost:3000/api/sessions?limit=invalid&offset=also-invalid");
      
      const response = await handleGetSessions(mockRequest);
      
      expect(response.status).toBe(200);
      // parseInt("invalid") returns NaN, so the service gets called with NaN values
      expect(mockGetSessions).toHaveBeenCalledWith({ limit: NaN, offset: NaN });
    });

    it("should include CORS headers", async () => {
      mockGetSessions.mockReturnValue([]);
      
      const mockRequest = new Request("http://localhost:3000/api/sessions");
      
      const response = await handleGetSessions(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });

  describe("handleGetSessionById", () => {
    it("should return session details when session exists", async () => {
      const mockSessionDetails = {
        session: { id: 1, session_id: "session-123", total_cost: 0.50 },
        messages: [
          { message_id: "msg-1", cost: 0.25, input_tokens: 100 },
          { message_id: "msg-2", cost: 0.25, input_tokens: 150 }
        ]
      };
      
      mockGetSessionDetails.mockReturnValue(mockSessionDetails);
      
      const mockRequest = {
        params: { id: "session-123" }
      } as Request & { params: { id: string } };
      
      const response = await handleGetSessionById(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockGetSessionDetails).toHaveBeenCalledWith("session-123");
      
      const body = await response.json();
      expect(body).toEqual(mockSessionDetails);
    });

    it("should return 404 when session does not exist", async () => {
      mockGetSessionDetails.mockReturnValue(null);
      
      const mockRequest = {
        params: { id: "nonexistent-session" }
      } as Request & { params: { id: string } };
      
      const response = await handleGetSessionById(mockRequest);
      
      expect(response.status).toBe(404);
      expect(mockGetSessionDetails).toHaveBeenCalledWith("nonexistent-session");
      
      const body = await response.json();
      expect(body).toEqual({ error: "Session not found" });
    });

    it("should include CORS headers in success response", async () => {
      const mockSessionDetails = {
        session: { id: 1, session_id: "session-123" },
        messages: []
      };
      
      mockGetSessionDetails.mockReturnValue(mockSessionDetails);
      
      const mockRequest = {
        params: { id: "session-123" }
      } as Request & { params: { id: string } };
      
      const response = await handleGetSessionById(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("should include CORS headers in error response", async () => {
      mockGetSessionDetails.mockReturnValue(null);
      
      const mockRequest = {
        params: { id: "nonexistent" }
      } as Request & { params: { id: string } };
      
      const response = await handleGetSessionById(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});