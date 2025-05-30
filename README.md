# Claude Code Metrics Collector

A real-time telemetry and analytics dashboard that collects OpenTelemetry metrics from Claude Code CLI sessions, providing comprehensive insights into usage patterns, costs, performance, and development workflows.

> **Built with Claude Code**: This project was created collaboratively using [Claude Code](https://claude.ai/code)

## 🚀 Features

- **Real-time Metrics Collection**: Ingests OTLP metrics from Claude Code CLI sessions
- **Session Analytics**: Track individual Claude Code sessions with detailed breakdowns
- **Cost Monitoring**: Monitor API costs across different models and usage patterns
- **Token Usage Tracking**: Detailed token consumption analytics (input, output, cache)
- **Message-Level Insights**: Drill down into individual messages with associated metrics
- **Performance Dashboard**: Visualize usage trends with interactive charts
- **Request Logging**: Monitor all incoming telemetry requests

## 📊 Dashboard Preview

The dashboard provides:
- Session overview with cost and token summaries
- Interactive charts showing usage over time
- Detailed session drill-downs with message history
- Metric type badges showing what data each message generated
- Real-time request logging and monitoring

## 🏗️ Architecture

### Technology Stack
- **Runtime**: [Bun](https://bun.sh) - Fast JavaScript runtime with built-in bundler
- **Frontend**: React 19 + TypeScript + Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui design system
- **Backend**: Single Bun server serving both API and frontend
- **Database**: SQLite with prepared statements for performance
- **Charts**: Recharts for data visualization
- **Routing**: Wouter (lightweight React router)
- **Telemetry**: OTLP-compliant metric ingestion

### Project Structure

```
claude-code-collector/
├── backend/                    # Server-side code
│   ├── lib/                   # Core backend logic
│   │   ├── database.ts        # SQLite database with prepared statements
│   │   ├── otlp.ts           # Main OTLP processor orchestrator
│   │   ├── session-processor.ts  # Session data management
│   │   ├── message-processor.ts  # Message data processing
│   │   ├── metric-processor.ts   # Metric data handling
│   │   └── services/         # Business logic services
│   ├── routes/               # API route handlers
│   ├── migrations/           # Database migrations (Kysely)
│   └── server.ts            # Main server entry point
├── src/                      # Frontend React application
│   ├── components/ui/        # shadcn/ui components
│   ├── Dashboard.tsx         # Main analytics dashboard
│   ├── SessionDetails.tsx    # Session drill-down view
│   └── Logs.tsx             # Request log viewer
├── tests/                    # Comprehensive test suite
└── dist/                     # Production build output
```

### Database Schema
- **sessions**: Aggregated Claude Code session data
- **messages**: Individual message cost/token tracking
- **metrics**: Raw telemetry data with labels
- **events**: Event data from Claude Code
- **request_logs**: HTTP request logging

## 🛠️ Getting Started

### Prerequisites
- [Bun](https://bun.sh) v1.2.14 or later
- [Claude Code CLI](https://claude.ai/code) for sending telemetry data

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd claude-code-collector
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Start development server**
   ```bash
   bun dev
   ```
   The application will be available at `http://localhost:3000`

4. **For production deployment**
   ```bash
   bun run build
   bun start
   ```

## 📡 Configuring Claude Code to Send Data

To start collecting metrics from your Claude Code sessions, configure the CLI to send telemetry data to your collector instance using OpenTelemetry environment variables:

### Recommended Configuration (Fish Shell)
```fish
# 1. Enable telemetry
set -x CLAUDE_CODE_ENABLE_TELEMETRY 1

# 2. Choose an exporter
set -x OTEL_METRICS_EXPORTER otlp       # Options: otlp, prometheus, console

# 3. Configure OTLP endpoint (for OTLP exporter)
set -x OTEL_EXPORTER_OTLP_PROTOCOL http/json
set -x OTEL_EXPORTER_OTLP_ENDPOINT http://localhost:3000

# 4. For debugging: reduce export interval (default: 600000ms/10min)
set -x OTEL_METRIC_EXPORT_INTERVAL 1000  # 1 second for testing
```

### Bash/Zsh Equivalent
```bash
# 1. Enable telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# 2. Choose an exporter
export OTEL_METRICS_EXPORTER=otlp       # Options: otlp, prometheus, console

# 3. Configure OTLP endpoint (for OTLP exporter)
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000

# 4. For debugging: reduce export interval (default: 600000ms/10min)
export OTEL_METRIC_EXPORT_INTERVAL=1000  # 1 second for testing
```

### Configuration Notes
- **Export Interval**: Set to 1000ms (1 second) for development/testing to see metrics quickly
- **Production**: Use default 600000ms (10 minutes) or adjust based on your needs
- **Protocol**: Uses `http/json` for human-readable debugging
- **Endpoint**: Points to your collector instance (change port if needed)

> 📚 **For more details**: See the official [Claude Code Monitoring Usage documentation](https://docs.anthropic.com/en/docs/claude-code/monitoring-usage) for comprehensive telemetry configuration options.

Once configured, your Claude Code sessions will automatically send telemetry data including:
- Session information (user, organization, model)
- Cost and token usage metrics
- Message-level tracking
- Tool usage and performance data
- Lines of code and edit statistics

## 🧪 Development

### Available Scripts
```bash
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

### API Endpoints

#### Telemetry Ingestion
- `POST /metrics` - OTLP metric ingestion
- `POST /events` - Event data ingestion
- `POST /v1/metrics` - Alternative OTLP endpoint

#### Dashboard API
- `GET /api/sessions` - List all sessions
- `GET /api/sessions/:id` - Get session details
- `GET /api/stats` - Dashboard statistics
- `GET /api/logs` - Request logs
- `GET /health` - Health check

### Testing
The project includes comprehensive tests covering:
- OTLP processing and metric ingestion
- Database operations and migrations
- API endpoints and error handling
- Individual processor modules
- Integration test scenarios

Run tests with:
```bash
bun test
```

## 🚀 Deployment

### Docker Support
```bash
# Build image
docker build -t claude-code-collector .

# Run container
docker run -p 3000:3000 claude-code-collector
```

### Production Considerations
- Set `NODE_ENV=production`
- Configure persistent SQLite database volume
- Set up reverse proxy (nginx/traefik) if needed
- Configure CORS for cross-origin requests
- Monitor disk space for database growth

## 🤝 Contributing

This project demonstrates collaborative development with Claude Code. The modular architecture makes it easy to extend with new features:

1. **Adding new metrics**: Extend the processor modules in `backend/lib/`
2. **UI enhancements**: Add components in `src/components/`
3. **New visualizations**: Integrate with the Recharts setup in Dashboard
4. **Database changes**: Add migrations in `backend/migrations/`

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Built collaboratively with [Claude Code](https://claude.ai/code)
- Powered by [Bun](https://bun.sh) for fast development and runtime
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Charts powered by [Recharts](https://recharts.org)

---

**Start collecting your Claude Code metrics today!** 🚀
