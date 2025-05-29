import { corsHeaders } from "../lib/utils";
import { getLogs, getLogsCount, parseLogsParams } from "../lib/services/logs-service";

export async function handleGetLogs(req: Request) {
  const url = new URL(req.url);
  const params = parseLogsParams(url);
  const logs = getLogs(params);
  const totalCount = getLogsCount();

  return Response.json({ logs, totalCount }, { headers: corsHeaders });
}