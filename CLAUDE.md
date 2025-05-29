# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Claude Code Metrics Collector** - a telemetry and analytics dashboard that ingests OpenTelemetry metrics from Claude Code CLI sessions and provides real-time analytics on usage, costs, and performance.

## Development Commands

```bash
# Install dependencies
bun install

# Development with hot reload
bun dev

# Production server
bun start

# Build for production  
bun run build

# Run tests
bun test

# Watch mode testing
bun test:watch
```

## Architecture

### Unified Server Pattern
Single Bun server (`backend/server.ts`) serves both API and frontend:
- **Telemetry endpoints** (`/metrics`, `/events`, `/v1/metrics`) - OTLP ingestion for external services
- **API endpoints** (`/api/*`) - JSON responses for frontend
- **Static serving** (`/*`) - React SPA

### Database
SQLite with prepared statements in `backend/lib/database.ts`:
- `metrics` - Raw telemetry data
- `sessions` - Aggregated Claude Code sessions 
- `messages` - Individual message cost/token tracking
- `events` - Event data
- `request_logs` - HTTP request logging

### Route Handler Pattern
Route definitions in `backend/server.ts` import handlers from `backend/routes/`:
- `metrics.ts` - Metric ingestion and querying
- `sessions.ts` - Session data and details
- `stats.ts` - Dashboard statistics
- `events.ts`, `logs.ts`, `health.ts` - Supporting endpoints

### OTLP Processing
`backend/lib/otlp.ts` processes OpenTelemetry metrics:
- Extracts session info from metric attributes/resources
- Updates session costs and token usage
- Handles message-level tracking
- Uses helper functions from `otlp-helpers.ts`

## Frontend Structure

React app in `src/` with:
- `App.tsx` - Main routing and layout
- `Dashboard.tsx` - Analytics with charts (Recharts)
- `SessionDetails.tsx` - Drill-down session view
- `Logs.tsx` - Request log viewer
- `components/ui/` - shadcn/ui components

## Key Technologies

- **Runtime**: Bun (fast JS runtime with built-in bundler)
- **Database**: SQLite with prepared statements for performance
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **UI**: Radix UI + shadcn/ui design system
- **Routing**: Wouter (lightweight React router)
- **Charts**: Recharts for data visualization
- **Telemetry**: OTLP-compliant metric ingestion

## Development Notes

- Server entry point is `backend/server.ts` (not src/)
- All route logic is in `backend/routes/` files, not server.ts
- Database operations use prepared statements for performance
- Only data ingestion endpoints (POST /metrics, /events, /v1/metrics) are logged
- CORS enabled for cross-origin frontend requests
- Session tracking based on sessionId extraction from OTLP attributes