import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import {
  Activity,
  Clock,
  Code2,
  FileText,
  GitBranch,
  Package,
  Terminal,
  Users,
  DollarSign,
  Hash,
} from "lucide-react";

interface MetricStat {
  metric_name: string;
  count: number;
  total: number;
  average: number;
  min: number;
  max: number;
}

interface EventStat {
  event_type: string;
  event_name: string;
  count: number;
  avg_duration_ms: number | null;
}

interface SessionStats {
  total_sessions: number;
  unique_users: number;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  avg_cost_per_session: number;
  max_session_cost: number;
  total_messages: number;
  avg_cost_per_message: number;
}

interface Session {
  id: number;
  session_id: string;
  user_id: string;
  user_email: string;
  organization_id: string;
  model: string;
  total_cost: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  first_seen: string;
  last_seen: string;
}

interface DashboardData {
  metrics: MetricStat[];
  events: EventStat[];
  sessions: SessionStats;
  recentSessions: Session[];
}

const COLORS = [
  "#0088FE",
  "#00C49F",
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
];

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/stats");
      if (!response.ok) throw new Error("Failed to fetch stats");
      const stats = await response.json();
      setData(stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000); // Refresh every 1 second
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-destructive">Error: {error}</div>
      </div>
    );
  }

  if (!data) return null;

  // Process data for charts
  const commandMetrics = data.metrics.filter(
    (m) =>
      m.metric_name.includes("command") ||
      m.metric_name.includes("tool") ||
      m.metric_name.includes("api")
  );

  const eventsByType = data.events.reduce((acc, event) => {
    if (!acc[event.event_type]) {
      acc[event.event_type] = 0;
    }
    acc[event.event_type] += event.count;
    return acc;
  }, {} as Record<string, number>);

  const eventTypeData = Object.entries(eventsByType).map(([name, value]) => ({
    name,
    value,
  }));

  const topCommands = commandMetrics
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((m) => ({
      name: m.metric_name.replace("command.", "").replace("tool.", ""),
      count: m.count,
      avg: Math.round(m.average * 100) / 100,
    }));

  const chartConfig = {
    count: {
      label: "Count",
      color: "hsl(var(--chart-1))",
    },
    avg: {
      label: "Average",
      color: "hsl(var(--chart-2))",
    },
  } satisfies ChartConfig;

  // Calculate summary stats
  const totalMetrics = data.metrics.reduce((sum, m) => sum + m.count, 0);
  const totalEvents = data.events.reduce((sum, e) => sum + e.count, 0);
  const uniqueMetrics = data.metrics.length;
  const uniqueEvents = new Set(data.events.map((e) => e.event_name)).size;

  // Calculate total tokens (input + output only, cache tokens are a subset of input)
  const totalTokens =
    (data.sessions?.total_input_tokens || 0) +
    (data.sessions?.total_output_tokens || 0);

  // Calculate uncached tokens
  const cachedTokens =
    (data.sessions?.total_cache_read_tokens || 0) +
    (data.sessions?.total_cache_creation_tokens || 0);
  // Uncached = all output tokens + (input tokens - cache read tokens)
  const uncachedInputTokens = Math.max(
    0,
    (data.sessions?.total_input_tokens || 0) -
      (data.sessions?.total_cache_read_tokens || 0)
  );
  const uncachedTokens =
    (data.sessions?.total_output_tokens || 0) + uncachedInputTokens;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.sessions?.total_sessions || 0}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <div>{data.sessions?.total_messages || 0} messages</div>
              <div>{data.sessions?.unique_users || 0} unique users</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${(data.sessions?.total_cost || 0).toFixed(2)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <div>
                Avg ${(data.sessions?.avg_cost_per_session || 0).toFixed(2)}
                /session
              </div>
              <div>
                Avg ${(data.sessions?.avg_cost_per_message || 0).toFixed(4)}
                /message
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalTokens.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <div>
                Input:{" "}
                {(data.sessions?.total_input_tokens || 0).toLocaleString()}
              </div>
              <div>
                Output:{" "}
                {(data.sessions?.total_output_tokens || 0).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Uncached Tokens
            </CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {uncachedTokens.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <div>Input: {uncachedInputTokens.toLocaleString()}</div>
              <div>
                Output:{" "}
                {(data.sessions?.total_output_tokens || 0).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Tokens</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {cachedTokens.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              <div>
                Read:{" "}
                {(data.sessions?.total_cache_read_tokens || 0).toLocaleString()}
              </div>
              <div>
                Creation:{" "}
                {(
                  data.sessions?.total_cache_creation_tokens || 0
                ).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Session Metrics</CardTitle>
            <CardDescription>Price and token usage per session</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                cost: {
                  label: "Cost ($)",
                  color: "#0088FE",
                },
                inputTokens: {
                  label: "Input Tokens (k)",
                  color: "#00C49F",
                },
                outputTokens: {
                  label: "Output Tokens (k)",
                  color: "#FFBB28",
                },
              }}
              className="h-[300px]"
            >
              <BarChart
                data={
                  data.recentSessions?.slice(-10).map((session, index) => ({
                    session: `S${index + 1}`,
                    cost: session.total_cost,
                    inputTokens: session.total_input_tokens / 1000, // Scale down for better visualization
                    outputTokens: session.total_output_tokens / 1000,
                  })) || []
                }
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="session" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar yAxisId="left" dataKey="cost" fill="var(--color-cost)" />
                <Bar
                  yAxisId="right"
                  dataKey="inputTokens"
                  fill="var(--color-inputTokens)"
                />
                <Bar
                  yAxisId="right"
                  dataKey="outputTokens"
                  fill="var(--color-outputTokens)"
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Usage Breakdown</CardTitle>
            <CardDescription>Distribution of token types</CardDescription>
          </CardHeader>
          <CardContent>
            {data.sessions && (
              <ChartContainer config={chartConfig} className="h-[300px]">
                <PieChart>
                  <Pie
                    data={[
                      {
                        name: "Input",
                        value: data.sessions.total_input_tokens || 0,
                      },
                      {
                        name: "Output",
                        value: data.sessions.total_output_tokens || 0,
                      },
                      {
                        name: "Cache Read",
                        value: data.sessions.total_cache_read_tokens || 0,
                      },
                      {
                        name: "Cache Creation",
                        value: data.sessions.total_cache_creation_tokens || 0,
                      },
                    ].filter((item) => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) =>
                      `${name} ${(percent * 100).toFixed(0)}%`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[0, 1, 2, 3].map((index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Latest Claude Code sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.recentSessions?.length > 0 ? (
              data.recentSessions.map((session) => (
                <Link
                  key={session.session_id}
                  href={`/sessions/${session.session_id}`}
                  className="flex items-center justify-between border-b pb-2 hover:bg-muted/50 px-2 -mx-2 rounded cursor-pointer transition-colors"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {session.user_email || "Unknown User"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Model: {session.model} • Session:{" "}
                      {session.session_id.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-sm font-semibold">
                      ${session.total_cost.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(
                        session.total_input_tokens + session.total_output_tokens
                      ).toLocaleString()}{" "}
                      tokens
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No sessions recorded yet
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
