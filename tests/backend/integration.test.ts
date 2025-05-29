import { describe, test, expect, beforeAll, afterAll } from "bun:test";

describe("API Integration Tests", () => {
  const baseUrl = process.env.TEST_SERVER_URL || "http://localhost:3002";
  
  beforeAll(async () => {
    // Note: These tests assume the backend server is running manually
    // Set TEST_SERVER_URL environment variable to override default URL
    console.log(`Running integration tests against: ${baseUrl}`);
    
    // Quick health check to verify server is running
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (!response.ok) {
        console.warn(`Server may not be running at ${baseUrl} - some tests may fail`);
      }
    } catch (error) {
      console.warn(`Cannot connect to server at ${baseUrl} - tests will likely fail`);
      console.warn("Make sure the backend server is running manually");
    }
  });

  describe("Health Check", () => {
    test("should return OK status", async () => {
      const response = await fetch(`${baseUrl}/health`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });
  });

  describe("OTLP Endpoint", () => {
    test("should accept OTLP metrics data", async () => {
      const otlpData = {
        resourceMetrics: [
          {
            resource: {
              attributes: [
                {
                  key: "session.id",
                  value: { stringValue: "test-session-integration" }
                },
                {
                  key: "user.id", 
                  value: { stringValue: "test-user-integration" }
                },
                {
                  key: "user.email",
                  value: { stringValue: "integration@test.com" }
                }
              ]
            },
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: "conversation.message.cost",
                    sum: {
                      isMonotonic: true,
                      dataPoints: [
                        {
                          attributes: [
                            {
                              key: "message.id",
                              value: { stringValue: "msg-integration-test" }
                            },
                            {
                              key: "role",
                              value: { stringValue: "user" }
                            }
                          ],
                          asDouble: 0.15,
                          timeUnixNano: Date.now() * 1000000
                        }
                      ]
                    }
                  },
                  {
                    name: "conversation.message.tokens",
                    sum: {
                      isMonotonic: true,
                      dataPoints: [
                        {
                          attributes: [
                            {
                              key: "message.id", 
                              value: { stringValue: "msg-integration-test" }
                            },
                            {
                              key: "type",
                              value: { stringValue: "input" }
                            }
                          ],
                          asInt: 150,
                          timeUnixNano: Date.now() * 1000000
                        }
                      ]
                    }
                  }
                ]
              }
            ]
          }
        ]
      };

      const response = await fetch(`${baseUrl}/v1/metrics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(otlpData),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe("Stats Endpoint", () => {
    test("should return aggregated statistics", async () => {
      const response = await fetch(`${baseUrl}/stats`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("metrics");
      expect(data).toHaveProperty("events");
      expect(data).toHaveProperty("sessions");
      expect(data).toHaveProperty("recentSessions");
      
      expect(Array.isArray(data.metrics)).toBe(true);
      expect(Array.isArray(data.events)).toBe(true);
      expect(Array.isArray(data.recentSessions)).toBe(true);
      
      expect(typeof data.sessions).toBe("object");
      expect(data.sessions).toHaveProperty("total_sessions");
      expect(data.sessions).toHaveProperty("total_messages");
    });
  });

  describe("Sessions Endpoint", () => {
    test("should return sessions list", async () => {
      const response = await fetch(`${baseUrl}/sessions`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("sessions");
      expect(Array.isArray(data.sessions)).toBe(true);
    });

    test("should return session details for valid session", async () => {
      // First get a session ID from the sessions list
      const sessionsResponse = await fetch(`${baseUrl}/sessions`);
      const sessionsData = await sessionsResponse.json();
      
      if (sessionsData.sessions.length > 0) {
        const sessionId = sessionsData.sessions[0].session_id;
        
        const response = await fetch(`${baseUrl}/sessions/${sessionId}`);
        const data = await response.json();
        
        expect(response.status).toBe(200);
        expect(data).toHaveProperty("session");
        expect(data).toHaveProperty("messages");
        expect(data).toHaveProperty("metrics");
        expect(data).toHaveProperty("events");
        
        expect(data.session.session_id).toBe(sessionId);
        expect(Array.isArray(data.messages)).toBe(true);
        expect(Array.isArray(data.metrics)).toBe(true);
        expect(Array.isArray(data.events)).toBe(true);
      }
    });

    test("should return 404 for non-existent session", async () => {
      const response = await fetch(`${baseUrl}/sessions/non-existent-session`);
      const data = await response.json();
      
      expect(response.status).toBe(404);
      expect(data.error).toBe("Session not found");
    });
  });

  describe("Metrics Endpoint", () => {
    test("should return metrics list", async () => {
      const response = await fetch(`${baseUrl}/metrics`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("metrics");
      expect(Array.isArray(data.metrics)).toBe(true);
    });

    test("should accept custom metrics via POST", async () => {
      const customMetric = {
        type: "gauge",
        name: "test.custom.metric",
        value: 42,
        labels: { test: "integration" },
        session_id: "test-session-custom",
        metadata: { source: "integration-test" }
      };

      const response = await fetch(`${baseUrl}/metrics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(customMetric),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toBe("Metric stored");
    });
  });

  describe("CORS Headers", () => {
    test("should include CORS headers in responses", async () => {
      const response = await fetch(`${baseUrl}/health`);
      
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe("POST, GET, OPTIONS");
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-Service");
    });

    test("should handle OPTIONS preflight requests", async () => {
      const response = await fetch(`${baseUrl}/health`, {
        method: "OPTIONS"
      });
      
      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });
  });
});