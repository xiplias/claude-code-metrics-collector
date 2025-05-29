import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Search, Filter, Clock, Globe, User, FileText, AlertCircle, CheckCircle, XCircle } from "lucide-react";
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
}

export function Logs() {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/logs?limit=200');
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(data.logs || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 1000); // Refresh every 1 second
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Filter logs based on search and filters
  const filteredLogs = logs.filter(log => {
    const matchesSearch = searchTerm === "" || 
      log.endpoint.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.ip_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.error_message && log.error_message.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesMethod = methodFilter === "all" || log.method === methodFilter;
    
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "success" && log.response_status >= 200 && log.response_status < 300) ||
      (statusFilter === "error" && log.response_status >= 400);
    
    return matchesSearch && matchesMethod && matchesStatus;
  });

  const getStatusBadge = (status: number) => {
    if (status >= 200 && status < 300) {
      return <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
        <CheckCircle className="w-3 h-3 mr-1" />
        {status}
      </Badge>;
    } else if (status >= 400 && status < 500) {
      return <Badge variant="destructive" className="bg-yellow-100 text-yellow-800 border-yellow-200">
        <AlertCircle className="w-3 h-3 mr-1" />
        {status}
      </Badge>;
    } else if (status >= 500) {
      return <Badge variant="destructive">
        <XCircle className="w-3 h-3 mr-1" />
        {status}
      </Badge>;
    }
    return <Badge variant="outline">{status}</Badge>;
  };

  const getMethodBadge = (method: string) => {
    const colors = {
      GET: "bg-blue-100 text-blue-800 border-blue-200",
      POST: "bg-green-100 text-green-800 border-green-200", 
      PUT: "bg-yellow-100 text-yellow-800 border-yellow-200",
      DELETE: "bg-red-100 text-red-800 border-red-200",
      OPTIONS: "bg-gray-100 text-gray-800 border-gray-200"
    };
    
    return (
      <Badge variant="outline" className={colors[method as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {method}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatUserAgent = (userAgent: string) => {
    if (userAgent.length > 50) {
      return userAgent.substring(0, 50) + "...";
    }
    return userAgent;
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Request Logs</h1>
          <p className="text-muted-foreground">Monitor all API requests and responses</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={autoRefresh ? "default" : "outline"}
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="gap-2"
          >
            <RefreshCw className={cn("w-4 h-4", autoRefresh && "animate-spin")} />
            Auto Refresh
          </Button>
          <Button onClick={fetchLogs} disabled={loading} className="gap-2">
            <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="text-destructive">Error: {error}</div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search endpoints, IPs, or errors..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="OPTIONS">OPTIONS</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success (2xx)</SelectItem>
                <SelectItem value="error">Errors (4xx/5xx)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {logs.length} requests
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No logs found matching your filters
              </div>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getMethodBadge(log.method)}
                        <code className="px-2 py-1 bg-muted rounded text-sm font-mono">
                          {log.endpoint}
                        </code>
                        {getStatusBadge(log.response_status)}
                        <Badge variant="outline" className="gap-1">
                          <Clock className="w-3 h-3" />
                          {log.response_time_ms}ms
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {log.ip_address}
                        </div>
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {formatUserAgent(log.user_agent)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatTimestamp(log.timestamp)}
                        </div>
                      </div>

                      {log.error_message && (
                        <div className="text-sm text-destructive bg-destructive/10 rounded p-2">
                          <div className="flex items-center gap-1 font-medium">
                            <AlertCircle className="w-3 h-3" />
                            Error:
                          </div>
                          {log.error_message}
                        </div>
                      )}

                      {log.request_body && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                            <FileText className="w-3 h-3" />
                            Request Body
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded overflow-x-auto text-xs">
                            {JSON.stringify(JSON.parse(log.request_body), null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}