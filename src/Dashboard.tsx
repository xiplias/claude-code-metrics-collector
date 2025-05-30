import { Link } from "wouter";
import { useStats, useSessions } from "./hooks/api-hooks";
import { formatters, calculations } from "./lib/formatters";
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
  Loader2,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const COLORS = [
  "#0088FE",
  "#00C49F", 
  "#FFBB28",
  "#FF8042",
  "#8884D8",
  "#82CA9D",
];

// Pure component for main stats cards
function StatsCards({ stats }: { stats: any }) {
  // Safety check for stats
  if (!stats) {
    return <StatsSkeleton />;
  }

  const totalTokens = calculations.totalTokens(
    stats.total_input_tokens,
    stats.total_output_tokens,
    stats.total_cache_read_tokens,
    stats.total_cache_creation_tokens
  );
  
  const cacheHitRatio = calculations.cacheHitRatio(stats.total_cache_read_tokens, totalTokens);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatters.number(stats.total_sessions)}</div>
          <p className="text-xs text-muted-foreground">
            {formatters.number(stats.total_messages)} total messages
          </p>
          <p className="text-xs text-muted-foreground">
            {formatters.currency(stats.avg_cost_per_message)}/message avg
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatters.currency(stats.total_cost)}
          </div>
          <p className="text-xs text-muted-foreground">
            Avg per session: {formatters.currency(stats.total_cost / (stats.total_sessions || 1))}
          </p>
          <p className="text-xs text-muted-foreground">
            Avg per message: {formatters.currency(stats.avg_cost_per_message)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
          <Hash className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatters.tokens(stats.total_input_tokens + stats.total_output_tokens)}
          </div>
          <p className="text-xs text-muted-foreground">
            Input: {formatters.tokens(stats.total_input_tokens)}
          </p>
          <p className="text-xs text-muted-foreground">
            Output: {formatters.tokens(stats.total_output_tokens)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cache Efficiency</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatters.percentage(cacheHitRatio * 100, 100)}
          </div>
          <p className="text-xs text-muted-foreground">
            Read: {formatters.tokens(stats.total_cache_read_tokens)}
          </p>
          <p className="text-xs text-muted-foreground">
            Created: {formatters.tokens(stats.total_cache_creation_tokens)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Pure component for model usage chart
function ModelUsageChart({ modelUsage }: { modelUsage: any[] }) {
  // Safety check for modelUsage
  if (!modelUsage || modelUsage.length === 0) {
    return <ChartSkeleton />;
  }

  const chartData = modelUsage.map(model => ({
    model: model.model?.split('-').pop() || model.model || 'Unknown', // Shorten model names
    cost: model.total_cost || 0,
    messages: model.message_count || 0,
  }));

  const chartConfig = {
    cost: {
      label: "Cost ($)",
      color: "#0088FE",
    },
    messages: {
      label: "Messages",
      color: "#00C49F",
    },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage by Model</CardTitle>
        <CardDescription>Cost and message count per model</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px]">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="model" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar yAxisId="left" dataKey="cost" fill="var(--color-cost)" />
            <Bar yAxisId="right" dataKey="messages" fill="var(--color-messages)" />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

// Pure component for recent sessions
function RecentSessionsList({ sessions }: { sessions: any[] }) {
  if (!sessions || sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Sessions</CardTitle>
          <CardDescription>Latest Claude Code sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-4">
            No sessions found
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sessions</CardTitle>
        <CardDescription>Latest Claude Code sessions (auto-refreshes every 5s)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {sessions.slice(0, 10).map((session) => (
            <div key={session.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <Link 
                      href={`/sessions/${session.session_id}`}
                      className="font-medium hover:underline"
                    >
                      {session.user_email}
                    </Link>
                    <Badge variant="outline" className="text-xs">
                      {session.model}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Started {formatters.timeAgo(session.first_seen)} • Last message {formatters.timeAgo(session.last_seen)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Session: {session.session_id.slice(0, 8)}...
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-4 text-sm">
                <div className="text-right">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {formatters.number(session.message_count || 0)} messages
                    </Badge>
                    <span className="font-medium">{formatters.currency(session.total_cost)}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {formatters.tokens(session.total_input_tokens + session.total_output_tokens)} tokens
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// Loading skeleton components
function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            <div className="h-4 w-4 bg-muted rounded animate-pulse" />
          </CardHeader>
          <CardContent>
            <div className="h-8 w-16 bg-muted rounded animate-pulse mb-2" />
            <div className="h-3 w-24 bg-muted rounded animate-pulse mb-1" />
            <div className="h-3 w-20 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="h-6 w-32 bg-muted rounded animate-pulse mb-2" />
        <div className="h-4 w-48 bg-muted rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-[300px] bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  // React Query hooks for data fetching
  const { 
    data: stats, 
    isLoading: statsLoading, 
    error: statsError,
    isRefetching: statsRefetching,
    refetch: refetchStats
  } = useStats({ refetchInterval: 5000 }); // 5 seconds

  // Sessions are now included in stats response as recent_sessions
  const sessions = stats?.recent_sessions || [];

  // Loading state
  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </div>
        </div>
        <StatsSkeleton />
        <div className="grid gap-6 md:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      </div>
    );
  }

  // Error state
  if (statsError) {
    const error = statsError;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <Button variant="outline" onClick={() => refetchStats()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-destructive mb-2">
              Error loading dashboard: {error?.message}
            </div>
            <Button variant="outline" onClick={() => refetchStats()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="flex items-center gap-2">
          {statsRefetching && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-3 w-3 animate-spin" />
              Refreshing...
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => refetchStats()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Statistics */}
      <StatsCards stats={stats} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Model Usage Chart */}
        {stats?.cost_by_model && <ModelUsageChart modelUsage={stats.cost_by_model} />}

        {/* Recent Sessions */}
        <RecentSessionsList sessions={sessions} />
      </div>

      {/* Additional Info */}
      <Card>
        <CardHeader>
          <CardTitle>System Status</CardTitle>
          <CardDescription>Real-time telemetry collection status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-green-500 rounded-full" />
              <span>Telemetry Active</span>
            </div>
            <div className="text-muted-foreground">
              Auto-refresh: 5s
            </div>
            <div className="text-muted-foreground">
              Last update: {formatters.timeAgo(new Date().toISOString())}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}