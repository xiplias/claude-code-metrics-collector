import { Route, Link, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dashboard } from "./Dashboard";
import { Logs } from "./Logs";
import { SessionDetails } from "./SessionDetails";
import { BarChart3, Code2, ScrollText } from "lucide-react";
import "./index.css";

export function App() {
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

export default App;
