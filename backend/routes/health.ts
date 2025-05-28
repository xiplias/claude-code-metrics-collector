import { corsHeaders, logRequest } from "../utils";

export const healthRoutes = {
  // GET /health - Health check
  "/health": {
    async GET(req: Request) {
      const startTime = Date.now();
      const responseTime = Date.now() - startTime;
      
      logRequest(req, "/health", 200, responseTime);
      
      return Response.json(
        { 
          status: "healthy", 
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        },
        { headers: corsHeaders }
      );
    },
  },
};