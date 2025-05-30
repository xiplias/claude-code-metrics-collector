import { Route, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dashboard } from "./Dashboard";
import { Logs } from "./Logs";
import { SessionDetails } from "./SessionDetails";
import { BarChart3, Code2, ScrollText } from "lucide-react";
import "./index.css";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as any).status;
          if (status >= 400 && status < 500) return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
  },
});

function AppContent() {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Code2 className="h-6 w-6" />
              <h1 className="text-2xl font-bold">
                Claude Code Metrics Collector
              </h1>
            </Link>
            <nav className="flex gap-2">
              <Link href="/">
                <Button
                  variant={location === "/" ? "default" : "outline"}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/logs">
                <Button
                  variant={location === "/logs" ? "default" : "outline"}
                  className="gap-2"
                >
                  <ScrollText className="h-4 w-4" />
                  Logs
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Route path="/" component={Dashboard} />
        <Route path="/logs" component={Logs} />
        <Route path="/sessions/:id" component={SessionDetails} />
      </main>
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
