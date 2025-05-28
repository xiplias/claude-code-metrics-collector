import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, Line, LineChart, Pie, PieChart, XAxis, YAxis, Cell } from "recharts";
import { Activity, Clock, Code2, FileText, GitBranch, Package, Terminal, Users } from "lucide-react";

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

interface DashboardData {
  metrics: MetricStat[];
  events: EventStat[];
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const stats = await response.json();
      setData(stats);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
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
  const commandMetrics = data.metrics.filter(m => 
    m.metric_name.includes('command') || 
    m.metric_name.includes('tool') ||
    m.metric_name.includes('api')
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
    value
  }));

  const topCommands = commandMetrics
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map(m => ({
      name: m.metric_name.replace('command.', '').replace('tool.', ''),
      count: m.count,
      avg: Math.round(m.average * 100) / 100
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
  const uniqueEvents = new Set(data.events.map(e => e.event_name)).size;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Metrics</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMetrics.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {uniqueMetrics} unique metric types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
            <Terminal className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {uniqueEvents} unique event types
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Commands</CardTitle>
            <Code2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{commandMetrics.length}</div>
            <p className="text-xs text-muted-foreground">
              Commands tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.events.length > 0 
                ? Math.round(
                    data.events
                      .filter(e => e.avg_duration_ms)
                      .reduce((sum, e) => sum + (e.avg_duration_ms || 0), 0) / 
                    data.events.filter(e => e.avg_duration_ms).length
                  )
                : 0}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Average duration
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Commands</CardTitle>
            <CardDescription>Most frequently used commands and tools</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={topCommands} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-count)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Event Distribution</CardTitle>
            <CardDescription>Breakdown of events by type</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <PieChart>
                <Pie
                  data={eventTypeData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {eventTypeData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
          <CardDescription>Command usage over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground text-center py-8">
            Timeline visualization requires time-series data collection
          </div>
        </CardContent>
      </Card>
    </div>
  );
}