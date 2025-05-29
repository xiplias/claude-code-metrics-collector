import { describe, it, expect } from "bun:test";
import { 
  validateEventData,
  parseEventData,
  getEvents
} from "../../../../backend/lib/services/events-service";

describe("EventsService", () => {
  describe("validateEventData", () => {
    it("should validate required event_type field", () => {
      const validData = { event_type: "user_action", event_name: "click" };
      const invalidData = { event_name: "click" };
      
      expect(validateEventData(validData).isValid).toBe(true);
      expect(validateEventData(invalidData).isValid).toBe(false);
      expect(validateEventData(invalidData).error).toBe("event_type is required");
    });

    it("should validate required event_name field", () => {
      const validData = { event_type: "user_action", event_name: "click" };
      const invalidData = { event_type: "user_action" };
      
      expect(validateEventData(validData).isValid).toBe(true);
      expect(validateEventData(invalidData).isValid).toBe(false);
      expect(validateEventData(invalidData).error).toBe("event_name is required");
    });

    it("should validate duration_ms type if provided", () => {
      const validData = { event_type: "user_action", event_name: "click", duration_ms: 100 };
      const invalidData = { event_type: "user_action", event_name: "click", duration_ms: "not a number" };
      
      expect(validateEventData(validData).isValid).toBe(true);
      expect(validateEventData(invalidData).isValid).toBe(false);
      expect(validateEventData(invalidData).error).toBe("duration_ms must be a number");
    });

    it("should allow undefined duration_ms", () => {
      const data = { event_type: "user_action", event_name: "click" };
      
      expect(validateEventData(data).isValid).toBe(true);
    });
  });

  describe("parseEventData", () => {
    it("should parse all event data fields", () => {
      const input = {
        event_type: "user_action",
        event_name: "button_click",
        project_path: "/test/project",
        user_id: "user123",
        session_id: "session456",
        duration_ms: 150,
        metadata: { button_id: "submit_btn" }
      };

      const result = parseEventData(input);

      expect(result.event_type).toBe("user_action");
      expect(result.event_name).toBe("button_click");
      expect(result.project_path).toBe("/test/project");
      expect(result.user_id).toBe("user123");
      expect(result.session_id).toBe("session456");
      expect(result.duration_ms).toBe(150);
      expect(result.metadata).toEqual({ button_id: "submit_btn" });
    });

    it("should handle minimal data", () => {
      const input = {
        event_type: "system",
        event_name: "startup"
      };

      const result = parseEventData(input);

      expect(result.event_type).toBe("system");
      expect(result.event_name).toBe("startup");
      expect(result.project_path).toBeUndefined();
      expect(result.user_id).toBeUndefined();
      expect(result.session_id).toBeUndefined();
      expect(result.duration_ms).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });
  });

  describe("getEvents", () => {
    it("should return events with limit and offset", () => {
      const params = { limit: 10, offset: 0 };
      const events = getEvents(params);
      
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeLessThanOrEqual(10);
      
      if (events.length > 0) {
        const firstEvent = events[0];
        expect(firstEvent).toHaveProperty("event_type");
        expect(firstEvent).toHaveProperty("event_name");
        expect(firstEvent).toHaveProperty("timestamp");
      }
    });

    it("should respect pagination parameters", () => {
      const page1 = getEvents({ limit: 5, offset: 0 });
      const page2 = getEvents({ limit: 5, offset: 5 });
      
      expect(page1.length).toBeLessThanOrEqual(5);
      expect(page2.length).toBeLessThanOrEqual(5);
      
      // If there are enough events, the pages should be different
      if (page1.length === 5 && page2.length > 0) {
        expect(page1[0]).not.toEqual(page2[0]);
      }
    });

    it("should return events in descending timestamp order", () => {
      const events = getEvents({ limit: 10, offset: 0 });
      
      if (events.length > 1) {
        for (let i = 1; i < events.length; i++) {
          const prevTimestamp = new Date(events[i-1].timestamp);
          const currTimestamp = new Date(events[i].timestamp);
          expect(prevTimestamp.getTime()).toBeGreaterThanOrEqual(currTimestamp.getTime());
        }
      }
    });
  });
});