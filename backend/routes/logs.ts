import { corsHeaders } from "../lib/utils";
import { getLogs, parseLogsParams } from "../lib/services/logs-service";

export async function handleGetLogs(req: Request) {
  const url = new URL(req.url);
  const params = parseLogsParams(url);
  const logs = getLogs(params);

  return Response.json({ logs }, { headers: corsHeaders });
}