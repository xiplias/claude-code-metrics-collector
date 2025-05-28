import { metricsRoutes } from "./metrics";
import { eventsRoutes } from "./events";
import { statsRoutes } from "./stats";
import { sessionsRoutes } from "./sessions";
import { logsRoutes } from "./logs";
import { healthRoutes } from "./health";

// Combine all route handlers
export const routes = {
  ...metricsRoutes,
  ...eventsRoutes,
  ...statsRoutes,
  ...sessionsRoutes,
  ...logsRoutes,
  ...healthRoutes,
};