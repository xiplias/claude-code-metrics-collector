import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APITester } from "./APITester";
import { Dashboard } from "./Dashboard";
import { BarChart3, Code2 } from "lucide-react";
import "./index.css";

export function App() {
  const [view, setView] = useState<"dashboard" | "api-tester">("dashboard");

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 className="h-6 w-6" />
              <h1 className="text-2xl font-bold">Claude Code Metrics Collector</h1>
            </div>
            <div className="flex gap-2">
              <Button
                variant={view === "dashboard" ? "default" : "outline"}
                onClick={() => setView("dashboard")}
                className="gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Dashboard
              </Button>
              <Button
                variant={view === "api-tester" ? "default" : "outline"}
                onClick={() => setView("api-tester")}
                className="gap-2"
              >
                <Code2 className="h-4 w-4" />
                API Tester
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {view === "dashboard" ? (
          <Dashboard />
        ) : (
          <Card className="max-w-4xl mx-auto">
            <CardContent className="pt-6">
              <h2 className="text-2xl font-bold mb-4">API Tester</h2>
              <p className="text-muted-foreground mb-6">
                Test the metrics collection API endpoints
              </p>
              <APITester />
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

export default App;
