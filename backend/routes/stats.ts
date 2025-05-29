import { corsHeaders } from "../lib/utils";
import { calculateStatsData } from "../lib/services/stats-service";

export async function handleGetStats(req: Request) {
  const statsData = calculateStatsData();
  
  return Response.json(statsData, { headers: corsHeaders });
}