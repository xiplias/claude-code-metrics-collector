import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRef, useState, type FormEvent } from "react";

export function APITester() {
  const responseInputRef = useRef<HTMLTextAreaElement>(null);
  const bodyInputRef = useRef<HTMLTextAreaElement>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState("/api/health");

  const predefinedEndpoints = [
    { value: "/api/health", label: "/api/health", method: "GET" },
    { value: "/api/metrics", label: "/api/metrics", method: "GET" },
    { value: "/api/metrics-post", label: "/api/metrics (POST)", method: "POST" },
    { value: "/api/events", label: "/api/events", method: "GET" },
    { value: "/api/events-post", label: "/api/events (POST)", method: "POST" },
    { value: "/api/stats", label: "/api/stats", method: "GET" },
    { value: "/api/v1/metrics", label: "/api/v1/metrics (OTLP)", method: "POST" },
    { value: "custom", label: "Custom endpoint...", method: "GET" }
  ];

  const sampleBodies = {
    "/api/metrics-post": JSON.stringify({
      metric_type: "counter",
      metric_name: "test_metric",
      metric_value: 1,
      labels: { env: "test" },
      project_path: "/test/project",
      user_id: "test-user",
      session_id: "test-session"
    }, null, 2),
    "/api/events-post": JSON.stringify({
      event_type: "user_action",
      event_name: "button_click",
      project_path: "/test/project",
      user_id: "test-user",
      session_id: "test-session",
      duration_ms: 100,
      metadata: { button: "submit" }
    }, null, 2),
    "/api/v1/metrics": JSON.stringify({
      resourceMetrics: [{
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: "test-service" } }
          ]
        },
        scopeMetrics: [{
          metrics: [{
            name: "test.counter",
            sum: {
              dataPoints: [{
                asInt: 42,
                timeUnixNano: Date.now() * 1000000
              }],
              isMonotonic: true
            }
          }]
        }]
      }]
    }, null, 2)
  };

  const testEndpoint = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      const endpointValue = formData.get("endpoint") as string;
      const method = formData.get("method") as string;
      
      let endpoint = endpointValue;
      if (endpointValue === "custom") {
        endpoint = formData.get("customEndpoint") as string;
      } else if (endpointValue.endsWith("-post")) {
        endpoint = endpointValue.replace("-post", "");
      }

      const url = new URL(endpoint, location.href);
      
      const options: RequestInit = { method };
      
      if (method === "POST") {
        options.headers = {
          "Content-Type": "application/json"
        };
        const body = bodyInputRef.current?.value;
        if (body) {
          options.body = body;
        }
      }

      const res = await fetch(url, options);

      const contentType = res.headers.get("content-type");
      let data;
      if (contentType?.includes("application/json")) {
        data = await res.json();
      } else {
        data = await res.text();
      }
      
      responseInputRef.current!.value = typeof data === "string" 
        ? data 
        : JSON.stringify(data, null, 2);
    } catch (error) {
      responseInputRef.current!.value = String(error);
    }
  };

  const handleEndpointChange = (value: string) => {
    setSelectedEndpoint(value);
    if (sampleBodies[value]) {
      if (bodyInputRef.current) {
        bodyInputRef.current.value = sampleBodies[value];
      }
    } else if (bodyInputRef.current) {
      bodyInputRef.current.value = "";
    }
  };

  const currentEndpoint = predefinedEndpoints.find(e => e.value === selectedEndpoint);
  const currentMethod = currentEndpoint?.method || "GET";

  return (
    <div className="mt-8 mx-auto w-full max-w-2xl text-left flex flex-col gap-4">
      <form
        onSubmit={testEndpoint}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center gap-2 bg-card p-3 rounded-xl font-mono border border-input w-full">
          <Select name="method" value={currentMethod}>
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            name="endpoint" 
            value={selectedEndpoint}
            onValueChange={handleEndpointChange}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select endpoint" />
            </SelectTrigger>
            <SelectContent>
              {predefinedEndpoints.map(endpoint => (
                <SelectItem key={endpoint.value} value={endpoint.value}>
                  {endpoint.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedEndpoint === "custom" && (
            <Input
              type="text"
              name="customEndpoint"
              defaultValue="/api/"
              className={cn(
                "flex-1 font-mono",
                "bg-transparent border-0 shadow-none",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
              )}
              placeholder="/api/custom"
            />
          )}

          <Button type="submit" variant="secondary">
            Send
          </Button>
        </div>

        {currentMethod === "POST" && (
          <textarea
            ref={bodyInputRef}
            placeholder="Request body (JSON)..."
            className={cn(
              "w-full min-h-[140px] bg-card",
              "border border-input rounded-xl p-3",
              "font-mono resize-y",
              "placeholder:text-muted-foreground",
            )}
          />
        )}
      </form>

      <textarea
        ref={responseInputRef}
        readOnly
        placeholder="Response will appear here..."
        className={cn(
          "w-full min-h-[140px] bg-card",
          "border border-input rounded-xl p-3",
          "font-mono resize-y",
          "placeholder:text-muted-foreground",
        )}
      />
    </div>
  );
}
