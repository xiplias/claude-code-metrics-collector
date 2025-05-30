import { describe, it, expect, beforeEach, mock } from "bun:test";
import { handlePostEvents, handleGetEvents } from "../../../backend/routes/events";

// Mock the events service
const mockRecordEvent = mock();
const mockGetEvents = mock();
const mockValidateEventData = mock();
const mockParseEventData = mock();

// Mock the utils
const mockLogRequest = mock();

mock.module("../../../backend/lib/services/events-service", () => ({
  recordEvent: mockRecordEvent,
  getEvents: mockGetEvents,
  validateEventData: mockValidateEventData,
  parseEventData: mockParseEventData
}));

mock.module("../../../backend/lib/utils", () => ({
  corsHeaders: {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Service"
  },
  logRequest: mockLogRequest
}));

describe("Events Route", () => {
  beforeEach(() => {
    mockRecordEvent.mockClear();
    mockGetEvents.mockClear();
    mockValidateEventData.mockClear();
    mockParseEventData.mockClear();
    mockLogRequest.mockClear();
  });

  describe("handlePostEvents", () => {
    it("should successfully record a valid event", async () => {
      const eventData = {
        type: "test-event",
        data: { key: "value" }
      };
      
      const parsedEventData = {
        ...eventData,
        timestamp: Date.now()
      };
      
      mockValidateEventData.mockReturnValue({ isValid: true });
      mockParseEventData.mockReturnValue(parsedEventData);
      
      const mockRequest = new Request("http://localhost:3000/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData)
      });
      
      const response = await handlePostEvents(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockValidateEventData).toHaveBeenCalledWith(eventData);
      expect(mockParseEventData).toHaveBeenCalledWith(eventData);
      expect(mockRecordEvent).toHaveBeenCalledWith(parsedEventData);
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/events",
        200,
        expect.any(Number),
        undefined,
        JSON.stringify(eventData)
      );
      
      const body = await response.json();
      expect(body).toEqual({
        success: true,
        message: "Event recorded"
      });
    });

    it("should return 400 for invalid event data", async () => {
      const invalidEventData = {
        invalid: "data"
      };
      
      mockValidateEventData.mockReturnValue({ 
        isValid: false,
        error: "Missing required field: type" 
      });
      
      const mockRequest = new Request("http://localhost:3000/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(invalidEventData)
      });
      
      const response = await handlePostEvents(mockRequest);
      
      expect(response.status).toBe(400);
      expect(mockValidateEventData).toHaveBeenCalledWith(invalidEventData);
      expect(mockParseEventData).not.toHaveBeenCalled();
      expect(mockRecordEvent).not.toHaveBeenCalled();
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/events",
        400,
        expect.any(Number),
        "Missing required field: type",
        JSON.stringify(invalidEventData)
      );
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Missing required field: type"
      });
    });

    it("should handle JSON parsing errors", async () => {
      const mockRequest = new Request("http://localhost:3000/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json"
      });
      
      const response = await handlePostEvents(mockRequest);
      
      expect(response.status).toBe(500);
      expect(mockValidateEventData).not.toHaveBeenCalled();
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/events",
        500,
        expect.any(Number),
        expect.stringContaining("JSON"),
        undefined
      );
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Failed to record event",
        message: expect.stringContaining("JSON")
      });
    });

    it("should handle errors during event recording", async () => {
      const eventData = {
        type: "test-event",
        data: { key: "value" }
      };
      
      mockValidateEventData.mockReturnValue({ isValid: true });
      mockParseEventData.mockReturnValue(eventData);
      mockRecordEvent.mockImplementation(() => {
        throw new Error("Database error");
      });
      
      const mockRequest = new Request("http://localhost:3000/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData)
      });
      
      const response = await handlePostEvents(mockRequest);
      
      expect(response.status).toBe(500);
      expect(mockLogRequest).toHaveBeenCalledWith(
        mockRequest,
        "/events",
        500,
        expect.any(Number),
        "Database error",
        JSON.stringify(eventData)
      );
      
      const body = await response.json();
      expect(body).toEqual({
        error: "Failed to record event",
        message: "Database error"
      });
    });

    it("should include CORS headers in response", async () => {
      mockValidateEventData.mockReturnValue({ isValid: true });
      mockParseEventData.mockReturnValue({ type: "test" });
      
      const mockRequest = new Request("http://localhost:3000/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "test" })
      });
      
      const response = await handlePostEvents(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Service");
    });
  });

  describe("handleGetEvents", () => {
    it("should return events with default pagination", async () => {
      const mockEvents = [
        { id: 1, type: "event1", timestamp: Date.now() },
        { id: 2, type: "event2", timestamp: Date.now() }
      ];
      
      mockGetEvents.mockReturnValue(mockEvents);
      
      const mockRequest = new Request("http://localhost:3000/api/events");
      
      const response = await handleGetEvents(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockGetEvents).toHaveBeenCalledWith({ limit: 100, offset: 0 });
      
      const body = await response.json();
      expect(body).toEqual({ events: mockEvents });
    });

    it("should handle custom pagination parameters", async () => {
      const mockEvents = [
        { id: 3, type: "event3", timestamp: Date.now() }
      ];
      
      mockGetEvents.mockReturnValue(mockEvents);
      
      const mockRequest = new Request("http://localhost:3000/api/events?limit=50&offset=100");
      
      const response = await handleGetEvents(mockRequest);
      
      expect(response.status).toBe(200);
      expect(mockGetEvents).toHaveBeenCalledWith({ limit: 50, offset: 100 });
      
      const body = await response.json();
      expect(body).toEqual({ events: mockEvents });
    });

    it("should handle invalid pagination parameters", async () => {
      const mockEvents = [];
      mockGetEvents.mockReturnValue(mockEvents);
      
      const mockRequest = new Request("http://localhost:3000/api/events?limit=invalid&offset=abc");
      
      const response = await handleGetEvents(mockRequest);
      
      expect(response.status).toBe(200);
      // parseInt returns NaN for invalid values
      expect(mockGetEvents).toHaveBeenCalledWith({ limit: NaN, offset: NaN });
      
      const body = await response.json();
      expect(body).toEqual({ events: mockEvents });
    });

    it("should include CORS headers in response", async () => {
      mockGetEvents.mockReturnValue([]);
      
      const mockRequest = new Request("http://localhost:3000/api/events");
      
      const response = await handleGetEvents(mockRequest);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Service");
    });
  });
});