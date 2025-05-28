# 1. Enable telemetry
export CLAUDE_CODE_ENABLE_TELEMETRY=1

# 2. Choose an exporter
export OTEL_METRICS_EXPORTER=otlp       # Options: otlp, prometheus, console

# 3. Configure OTLP endpoint (for OTLP exporter)
export OTEL_EXPORTER_OTLP_PROTOCOL=http/json
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:3000


# 5. For debugging: reduce export interval (default: 600000ms/10min)
export OTEL_METRIC_EXPORT_INTERVAL=1000  # 10 seconds

claude
