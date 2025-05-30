import { useCallback, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useSessionDetails, useSessionMessagesInfinite } from "./hooks/api-hooks";
import { formatters, calculations } from "./lib/formatters";
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
  MessageSquare,
  Coins,
  Loader2,
  FileText,
  Code,
  Plus,
  Minus,
} from "lucide-react";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

// Pure component for session stats
function SessionStats({ session, messageCount, duration }: {
  session: any;
  messageCount: number;
  duration: number;
}) {
  const durationMinutes = Math.floor(duration / (1000 * 60));
  const avgCostPerMessage = calculations.averageCostPerMessage(session.total_cost, messageCount);
  const totalTokens = calculations.totalTokens(
    session.total_input_tokens,
    session.total_output_tokens,
    session.total_cache_read_tokens,
    session.total_cache_creation_tokens
  );
  const cacheHitRatio = calculations.cacheHitRatio(session.total_cache_read_tokens, totalTokens);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatters.currency(session.total_cost)}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatters.currency(avgCostPerMessage)}/msg
          </p>
          <p className="text-xs text-muted-foreground">
            {formatters.currency(session.total_cost / (durationMinutes || 1))}/min
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
            {formatters.tokens(session.total_input_tokens + session.total_output_tokens)}
          </div>
          <p className="text-xs text-muted-foreground">
            Input: {formatters.tokens(session.total_input_tokens)}
          </p>
          <p className="text-xs text-muted-foreground">
            Output: {formatters.tokens(session.total_output_tokens)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Duration</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatters.duration(duration)}</div>
          <p className="text-xs text-muted-foreground">
            {formatters.datetime(session.first_seen)} - {formatters.datetime(session.last_seen)}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatters.number(messageCount)} messages
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
            {formatters.percentage(cacheHitRatio * 100, 100)}
          </div>
          <p className="text-xs text-muted-foreground">
            Read: {formatters.tokens(session.total_cache_read_tokens)}
          </p>
          <p className="text-xs text-muted-foreground">
            Created: {formatters.tokens(session.total_cache_creation_tokens)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Pure component for message item
function MessageItem({ message, index, totalMessages }: {
  message: any;
  index: number;
  totalMessages: number;
}) {
  const totalTokens = calculations.totalTokens(
    message.input_tokens,
    message.output_tokens,
    message.cache_read_tokens,
    message.cache_creation_tokens
  );

  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">Message {totalMessages - index}</span>
          
          {message.code_activity && (message.code_activity.has_code_changes || message.code_activity.has_file_operations) && (
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              <Code className="h-3 w-3" />
              Code
            </Badge>
          )}
          
          {message.role && (
            <Badge variant="outline">{message.role}</Badge>
          )}
          {message.model && (
            <Badge variant="default">{message.model}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="flex items-center gap-1">
            <Coins className="h-3 w-3" />
            {formatters.currency(message.cost)}
          </Badge>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">Input:</span>
          <span className="ml-1 font-medium">{formatters.tokens(message.input_tokens)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Output:</span>
          <span className="ml-1 font-medium">{formatters.tokens(message.output_tokens)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Cache Read:</span>
          <span className="ml-1 font-medium">{formatters.tokens(message.cache_read_tokens)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Cache Create:</span>
          <span className="ml-1 font-medium">{formatters.tokens(message.cache_creation_tokens)}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>ID: {message.message_id}</span>
        <span>{formatters.datetime(message.timestamp)}</span>
      </div>
      
      {/* Code Changes Section */}
      {message.code_activity && (message.code_activity.has_code_changes || message.code_activity.has_file_operations) && (
        <div className="pt-2 border-t">
          <div className="flex items-center gap-2 mb-2">
            <Code className="h-3 w-3 text-muted-foreground" />
            <div className="text-xs text-muted-foreground">Code Changes:</div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {message.code_activity.has_code_changes && (
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Modified Files
                </Badge>
                
                {message.code_activity.total_lines_added > 0 && (
                  <Badge variant="outline" className="text-xs text-green-600 flex items-center gap-1">
                    <Plus className="h-3 w-3" />
                    +{message.code_activity.total_lines_added}
                  </Badge>
                )}
                
                {message.code_activity.total_lines_removed > 0 && (
                  <Badge variant="outline" className="text-xs text-red-600 flex items-center gap-1">
                    <Minus className="h-3 w-3" />
                    -{message.code_activity.total_lines_removed}
                  </Badge>
                )}
              </div>
            )}
            
            {message.code_activity.tools_used && message.code_activity.tools_used.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {message.code_activity.tools_used.map((tool: string, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {tool}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {message.metric_types && message.metric_types.length > 0 && (
        <div className="pt-2 border-t">
          <div className="text-xs text-muted-foreground mb-1">Metrics:</div>
          <div className="flex flex-wrap gap-1">
            {message.metric_types.map((metricType: string, idx: number) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {metricType}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Hook for infinite scroll detection
function useInfiniteScroll(callback: () => void, hasMore: boolean, isFetching: boolean) {
  const observer = useRef<IntersectionObserver>();
  
  const lastElementRef = useCallback((node: HTMLDivElement) => {
    if (isFetching) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        callback();
      }
    }, { threshold: 1.0 });
    if (node) observer.current.observe(node);
  }, [callback, hasMore, isFetching]);

  return lastElementRef;
}

// Loading skeleton component
function MessageSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-2 animate-pulse">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 bg-muted rounded" />
          <div className="h-4 w-20 bg-muted rounded" />
          <div className="h-5 w-12 bg-muted rounded" />
        </div>
        <div className="h-5 w-16 bg-muted rounded" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-4 bg-muted rounded" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="h-3 w-32 bg-muted rounded" />
        <div className="h-3 w-24 bg-muted rounded" />
      </div>
    </div>
  );
}

export function SessionDetails() {
  const [match, params] = useRoute("/sessions/:id");
  const sessionId = params?.id;

  // React Query hooks for data fetching
  const { data: sessionData, isLoading: sessionLoading, error: sessionError } = useSessionDetails(sessionId!);
  const {
    data: messagesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: messagesLoading,
    error: messagesError
  } = useSessionMessagesInfinite(sessionId!, 20);

  // Infinite scroll setup
  const lastElementRef = useInfiniteScroll(
    () => fetchNextPage(),
    !!hasNextPage,
    isFetchingNextPage
  );

  if (!match) return null;

  // Loading state
  if (sessionLoading || messagesLoading) {
    return (
      <div className="space-y-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading session details...
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (sessionError || messagesError || !sessionData) {
    const error = sessionError || messagesError;
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
            Error: {error?.message || "Session not found"}
          </div>
        </div>
      </div>
    );
  }

  const session = sessionData.session;
  const allMessages = messagesData?.pages.flatMap(page => page.messages) || [];
  const totalMessageCount = messagesData?.pages[0]?.total || allMessages.length;
  const duration = calculations.sessionDuration(session.first_seen, session.last_seen);

  // Chart data generation
  const messageChartData = allMessages.slice(0, 20).map((msg, index) => ({
    message: `M${Math.min(allMessages.length, 20) - index}`,
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

      {/* Session Statistics */}
      <SessionStats 
        session={session} 
        messageCount={totalMessageCount} 
        duration={duration} 
      />

      {/* Session Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
          <CardDescription>
            Session ID: {session.session_id}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">User:</span>
              <span className="ml-2 font-medium">{session.user_email}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Organization:</span>
              <span className="ml-2 font-medium">{session.organization_id}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Model:</span>
              <span className="ml-2 font-medium">{session.model}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Last Activity:</span>
              <span className="ml-2 font-medium">{formatters.timeAgo(session.last_seen)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart Card */}
      {messageChartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Message Analytics</CardTitle>
            <CardDescription>
              Cost and token usage per message (first 20 messages)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="min-h-[300px]">
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
      )}

      {/* Messages Card with Infinite Scroll */}
      <Card>
        <CardHeader>
          <CardTitle>Messages ({formatters.number(totalMessageCount)})</CardTitle>
          <CardDescription>
            All messages in this session (most recent first) - Auto-updates every 5 seconds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {allMessages.length > 0 ? (
              <>
                {allMessages.map((message, index) => (
                  <div
                    key={message.id}
                    ref={index === allMessages.length - 1 ? lastElementRef : undefined}
                  >
                    <MessageItem 
                      message={message} 
                      index={index} 
                      totalMessages={totalMessageCount} 
                    />
                  </div>
                ))}
                
                {/* Loading more indicator */}
                {isFetchingNextPage && (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <MessageSkeleton key={i} />
                    ))}
                  </div>
                )}
                
                {/* End of list indicator */}
                {!hasNextPage && allMessages.length > 0 && (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    No more messages to load
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground text-center py-4">
                No messages recorded for this session
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}