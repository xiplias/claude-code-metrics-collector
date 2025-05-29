import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Clock,
  DollarSign,
  Hash,
  User,
  Activity,
} from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

interface SessionDetail {
  session: {
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
  };
  messages: Array<{
    id: number;
    message_id: string;
    conversation_id: string;
    role: string;
    model: string;
    cost: number;
    input_tokens: number;
    output_tokens: number;
    cache_creation_tokens: number;
    cache_read_tokens: number;
    timestamp: string;
  }>;
  events: Array<{
    id: number;
    event_type: string;
    event_name: string;
    duration_ms: number | null;
    timestamp: string;
    data: any;
  }>;
}

export function SessionDetails() {
  const [match, params] = useRoute("/sessions/:id");
  const sessionId = params?.id;
  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error(`Session ${sessionId} not found`);
          }
          throw new Error(
            `Failed to fetch session details: ${response.status}`
          );
        }
        const sessionData = await response.json();
        setData(sessionData);
        setError(null);
      } catch (err) {
        console.error("Error fetching session:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [sessionId]);

  if (!match) return null;

  if (loading) {
    return (
      <div className="space-y-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-muted-foreground">
            Loading session details...
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-destructive">
            Error: {error || "Session not found"}
          </div>
        </div>
      </div>
    );
  }

  const session = data.session;
  const duration =
    new Date(session.last_seen).getTime() -
    new Date(session.first_seen).getTime();
  const durationMinutes = Math.floor(duration / 1000 / 60);

  const messageChartData = data.messages.map((msg, index) => ({
    message: `M${index + 1}`,
    cost: msg.cost,
    inputTokens: msg.input_tokens,
    outputTokens: msg.output_tokens,
  }));

  const chartConfig = {
    cost: {
      label: "Cost ($)",
      color: "#0088FE",
    },
    inputTokens: {
      label: "Input Tokens",
      color: "#00C49F",
    },
    outputTokens: {
      label: "Output Tokens",
      color: "#FFBB28",
    },
  } satisfies ChartConfig;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Session Details</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${session.total_cost.toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.messages.length} messages
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
              {(
                session.total_input_tokens + session.total_output_tokens
              ).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              I: {session.total_input_tokens.toLocaleString()} / O:{" "}
              {session.total_output_tokens.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{durationMinutes}m</div>
            <p className="text-xs text-muted-foreground">
              {new Date(session.first_seen).toLocaleTimeString()} -{" "}
              {new Date(session.last_seen).toLocaleTimeString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Usage</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(
                (session.total_cache_read_tokens /
                  (session.total_input_tokens || 1)) *
                100
              ).toFixed(1)}
              %
            </div>
            <p className="text-xs text-muted-foreground">
              {session.total_cache_read_tokens.toLocaleString()} cached tokens
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
          <CardDescription>
            Details about this Claude Code session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Session ID</span>
            <code className="text-xs bg-muted px-2 py-1 rounded">
              {session.session_id}
            </code>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">User</span>
            <span className="text-sm">{session.user_email || "Unknown"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Model</span>
            <Badge variant="secondary">{session.model}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Organization</span>
            <span className="text-sm">{session.organization_id}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Message Costs & Tokens</CardTitle>
          <CardDescription>Token usage and cost per message</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <BarChart data={messageChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="message" />
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
          <CardTitle>Events Timeline</CardTitle>
          <CardDescription>Activities during this session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.events.length > 0 ? (
              data.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between border-b pb-2"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-medium">
                      {event.event_type}: {event.event_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(event.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {event.duration_ms && (
                    <Badge variant="outline">{event.duration_ms}ms</Badge>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No events recorded for this session
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
