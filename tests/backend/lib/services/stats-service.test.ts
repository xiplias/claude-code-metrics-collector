import { describe, it, expect, beforeEach } from "bun:test";
import { 
  getMetricStats, 
  getEventStats, 
  getSessionStats, 
  getMessageCount, 
  getRecentSessions,
  calculateStatsData 
} from "../../../../backend/lib/services/stats-service";

describe("StatsService", () => {
  describe("calculateStatsData", () => {
    it("should return a complete stats object", () => {
      const stats = calculateStatsData();
      
      expect(stats).toHaveProperty("metrics");
      expect(stats).toHaveProperty("events");
      expect(stats).toHaveProperty("sessions");
      expect(stats).toHaveProperty("recentSessions");
      
      expect(Array.isArray(stats.metrics)).toBe(true);
      expect(Array.isArray(stats.events)).toBe(true);
      expect(Array.isArray(stats.recentSessions)).toBe(true);
      
      expect(stats.sessions).toHaveProperty("total_sessions");
      expect(stats.sessions).toHaveProperty("unique_users");
      expect(stats.sessions).toHaveProperty("total_cost");
      expect(stats.sessions).toHaveProperty("total_messages");
      expect(stats.sessions).toHaveProperty("avg_cost_per_message");
    });

    it("should handle division by zero for avg_cost_per_message", () => {
      const stats = calculateStatsData();
      
      if (stats.sessions.total_messages === 0) {
        expect(stats.sessions.avg_cost_per_message).toBe(0);
      } else {
        expect(typeof stats.sessions.avg_cost_per_message).toBe("number");
        expect(stats.sessions.avg_cost_per_message).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("getRecentSessions", () => {
    it("should respect the limit parameter", () => {
      const sessions5 = getRecentSessions(5);
      const sessions10 = getRecentSessions(10);
      
      expect(sessions5.length).toBeLessThanOrEqual(5);
      expect(sessions10.length).toBeLessThanOrEqual(10);
    });

    it("should return sessions in descending order by last_seen", () => {
      const sessions = getRecentSessions(10);
      
      if (sessions.length > 1) {
        for (let i = 1; i < sessions.length; i++) {
          const prevLastSeen = new Date(sessions[i-1].last_seen);
          const currLastSeen = new Date(sessions[i].last_seen);
          expect(prevLastSeen.getTime()).toBeGreaterThanOrEqual(currLastSeen.getTime());
        }
      }
    });
  });

  describe("getMetricStats", () => {
    it("should return aggregated metric statistics", () => {
      const stats = getMetricStats();
      
      expect(Array.isArray(stats)).toBe(true);
      
      if (stats.length > 0) {
        const firstStat = stats[0];
        expect(firstStat).toHaveProperty("metric_name");
        expect(firstStat).toHaveProperty("count");
        expect(firstStat).toHaveProperty("total");
        expect(firstStat).toHaveProperty("average");
        expect(firstStat).toHaveProperty("min");
        expect(firstStat).toHaveProperty("max");
      }
    });
  });

  describe("getEventStats", () => {
    it("should return aggregated event statistics", () => {
      const stats = getEventStats();
      
      expect(Array.isArray(stats)).toBe(true);
      
      if (stats.length > 0) {
        const firstStat = stats[0];
        expect(firstStat).toHaveProperty("event_type");
        expect(firstStat).toHaveProperty("event_name");
        expect(firstStat).toHaveProperty("count");
        expect(firstStat).toHaveProperty("avg_duration_ms");
      }
    });
  });

  describe("getSessionStats", () => {
    it("should return session aggregate statistics", () => {
      const stats = getSessionStats();
      
      expect(stats).toHaveProperty("total_sessions");
      expect(stats).toHaveProperty("unique_users");
      expect(stats).toHaveProperty("total_cost");
      expect(stats).toHaveProperty("total_input_tokens");
      expect(stats).toHaveProperty("total_output_tokens");
      expect(stats).toHaveProperty("total_cache_read_tokens");
      expect(stats).toHaveProperty("total_cache_creation_tokens");
      expect(stats).toHaveProperty("avg_cost_per_session");
      expect(stats).toHaveProperty("max_session_cost");
      
      expect(typeof stats.total_sessions).toBe("number");
      expect(typeof stats.unique_users).toBe("number");
      expect(typeof stats.total_cost).toBe("number");
    });
  });

  describe("getMessageCount", () => {
    it("should return message count object", () => {
      const count = getMessageCount();
      
      expect(count).toHaveProperty("total_messages");
      expect(typeof count.total_messages).toBe("number");
      expect(count.total_messages).toBeGreaterThanOrEqual(0);
    });
  });
});