import { useState } from "react";
import { useLogs } from "./hooks/api-hooks";
import { formatters } from "./lib/formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, Search, Filter, Clock, Globe, User, FileText, AlertCircle, CheckCircle, XCircle, Database, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RequestLog {
  id: number;
  timestamp: string;
  endpoint: string;
  method: string;
  ip_address: string;
  user_agent: string;
  request_body: string | null;
  response_status: number;
  response_time_ms: number;
  error_message: string | null;
  extracted_data: string | null;
}

// Pure function for filtering logs
function filterLogs(logs: RequestLog[], searchTerm: string, methodFilter: string, statusFilter: string) {
  return logs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip_address.includes(searchTerm) ||
      log.user_agent.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesMethod = methodFilter === "all" || log.method === methodFilter;
    
    let matchesStatus = true;
    if (statusFilter === "success") matchesStatus = log.response_status >= 200 && log.response_status < 300;
    else if (statusFilter === "error") matchesStatus = log.response_status >= 400;
    else if (statusFilter !== "all") matchesStatus = log.response_status.toString().startsWith(statusFilter);
    
    return matchesSearch && matchesMethod && matchesStatus;
  });
}

// Pure component for status badge
function StatusBadge({ status }: { status: number }) {
  const getStatusVariant = (status: number) => {
    if (status >= 200 && status < 300) return "default";
    if (status >= 300 && status < 400) return "secondary";
    if (status >= 400 && status < 500) return "destructive";
    if (status >= 500) return "destructive";
    return "outline";
  };

  const getStatusIcon = (status: number) => {
    if (status >= 200 && status < 300) return <CheckCircle className="h-3 w-3" />;
    if (status >= 300 && status < 400) return <RefreshCw className="h-3 w-3" />;
    return <XCircle className="h-3 w-3" />;
  };

  return (
    <Badge variant={getStatusVariant(status)} className="flex items-center gap-1">
      {getStatusIcon(status)}
      {status}
    </Badge>
  );
}

// Pure component for method badge
function MethodBadge({ method }: { method: string }) {
  const getMethodColor = (method: string) => {
    switch (method) {
      case "GET": return "bg-blue-100 text-blue-800";
      case "POST": return "bg-green-100 text-green-800";
      case "PUT": return "bg-yellow-100 text-yellow-800";
      case "DELETE": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Badge className={cn("text-xs", getMethodColor(method))}>
      {method}
    </Badge>
  );
}

// Pure component for log item
function LogItem({ 
  log, 
  isExpanded, 
  onToggleExpand 
}: { 
  log: RequestLog; 
  isExpanded: boolean; 
  onToggleExpand: () => void;
}) {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleExpand}
            className="h-6 w-6 p-0"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          <MethodBadge method={log.method} />
          <code className="text-sm bg-muted px-2 py-1 rounded">{log.endpoint}</code>
          <StatusBadge status={log.response_status} />
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {log.response_time_ms}ms
          </div>
          <div>{formatters.datetime(log.timestamp)}</div>
        </div>
      </div>

      {isExpanded && (
        <div className="space-y-3 pt-3 border-t">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">IP Address:</span>
              <span className="ml-2 font-mono">{log.ip_address}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Response Time:</span>
              <span className="ml-2">{log.response_time_ms}ms</span>
            </div>
          </div>

          {log.user_agent && (
            <div className="text-sm">
              <span className="text-muted-foreground">User Agent:</span>
              <div className="mt-1 p-2 bg-muted rounded text-xs font-mono break-all">
                {log.user_agent}
              </div>
            </div>
          )}

          {log.request_body && (
            <div className="text-sm">
              <span className="text-muted-foreground">Request Body:</span>
              <div className="mt-1 p-2 bg-muted rounded text-xs font-mono max-h-40 overflow-y-auto">
                <pre>{JSON.stringify(JSON.parse(log.request_body), null, 2)}</pre>
              </div>
            </div>
          )}

          {log.extracted_data && (
            <div className="text-sm">
              <span className="text-muted-foreground">Extracted Data:</span>
              <div className="mt-1 p-2 bg-muted rounded text-xs font-mono max-h-40 overflow-y-auto">
                <pre>{JSON.stringify(JSON.parse(log.extracted_data), null, 2)}</pre>
              </div>
            </div>
          )}

          {log.error_message && (
            <div className="text-sm">
              <span className="text-muted-foreground text-destructive">Error:</span>
              <div className="mt-1 p-2 bg-destructive/10 rounded text-xs text-destructive">
                {log.error_message}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Loading skeleton
function LogsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border rounded-lg p-4 animate-pulse">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 bg-muted rounded" />
              <div className="h-5 w-12 bg-muted rounded" />
              <div className="h-6 w-32 bg-muted rounded" />
              <div className="h-5 w-12 bg-muted rounded" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-4 w-16 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Logs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());

  // React Query hook for logs
  const { 
    data: logs = [], 
    isLoading, 
    error, 
    refetch,
    isRefetching
  } = useLogs();

  // Filter logs based on current filters
  const filteredLogs = filterLogs(logs, searchTerm, methodFilter, statusFilter);

  // Toggle log expansion
  const toggleLogExpansion = (logId: number) => {
    const newExpanded = new Set(expandedLogs);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedLogs(newExpanded);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Request Logs</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading logs...
          </div>
        </div>
        <LogsSkeleton />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Request Logs</h1>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="text-destructive mb-2">
              Error loading logs: {error?.message}
            </div>
            <Button variant="outline" onClick={() => refetch()}>
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
        <h1 className="text-3xl font-bold tracking-tight">Request Logs</h1>
        <div className="flex items-center gap-2">
          {isRefetching && (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-3 w-3 animate-spin" />
              Refreshing...
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Card */}
      <Card>
        <CardHeader>
          <CardTitle>Log Statistics</CardTitle>
          <CardDescription>Real-time request monitoring (auto-refreshes every 5s)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              <span>Total Requests: {formatters.number(logs.length)}</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Successful: {formatters.number(logs.filter(l => l.response_status < 400).length)}</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span>Errors: {formatters.number(logs.filter(l => l.response_status >= 400).length)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>Avg Response: {logs.length > 0 ? Math.round(logs.reduce((acc, l) => acc + l.response_time_ms, 0) / logs.length) : 0}ms</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by endpoint, IP, or user agent..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success (2xx)</SelectItem>
                <SelectItem value="error">Error (4xx+)</SelectItem>
                <SelectItem value="2">2xx</SelectItem>
                <SelectItem value="3">3xx</SelectItem>
                <SelectItem value="4">4xx</SelectItem>
                <SelectItem value="5">5xx</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Request Logs ({formatters.number(filteredLogs.length)} 
            {filteredLogs.length !== logs.length && ` of ${formatters.number(logs.length)}`})
          </CardTitle>
          <CardDescription>
            Click on any log entry to expand details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredLogs.length > 0 ? (
            <div className="space-y-3">
              {filteredLogs.map((log) => (
                <LogItem
                  key={log.id}
                  log={log}
                  isExpanded={expandedLogs.has(log.id)}
                  onToggleExpand={() => toggleLogExpansion(log.id)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              {logs.length === 0 ? "No request logs found" : "No logs match the current filters"}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}