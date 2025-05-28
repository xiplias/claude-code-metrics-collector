import { extractAttributes } from "./utils";
import { 
  insertMetric, 
  upsertSession, 
  updateSessionCost, 
  insertMessage, 
  updateMessageTokens 
} from "./database";

// Process OTLP metrics data
export function processOTLPMetrics(data: any) {
  const resourceMetrics = data.resourceMetrics || [];

  for (const rm of resourceMetrics) {
    const resourceAttrs = extractAttributes(rm.resource?.attributes || []);
    const scopeMetrics = rm.scopeMetrics || [];

    for (const sm of scopeMetrics) {
      const metrics = sm.metrics || [];

      for (const metric of metrics) {
        const metricName = metric.name;

        // Handle different metric types
        if (metric.sum) {
          // Counter or UpDownCounter
          const dataPoints = metric.sum.dataPoints || [];
          for (const dp of dataPoints) {
            const attrs = extractAttributes(dp.attributes || []);
            const value = dp.asInt || dp.asDouble || 0;

            // Extract session info for Claude Code metrics
            const sessionId = attrs['session.id'] || attrs.session_id || resourceAttrs['session.id'] || resourceAttrs.session_id;
            const userId = attrs['user.id'] || attrs.user_id || resourceAttrs['user.id'] || resourceAttrs.user_id;
            const userEmail = attrs['user.email'] || resourceAttrs['user.email'];
            const orgId = attrs['organization.id'] || resourceAttrs['organization.id'];
            const model = attrs.model || resourceAttrs.model;

            // Create/update session if we have session data
            if (sessionId && metricName === 'claude_code.cost.usage') {
              upsertSession.run(sessionId, userId, userEmail, orgId, model);
              updateSessionCost.run(value, 0, 0, 0, 0, sessionId);
            } else if (sessionId && metricName === 'claude_code.token.usage') {
              const tokenType = attrs.type;
              const inputTokens = tokenType === 'input' ? value : 0;
              const outputTokens = tokenType === 'output' ? value : 0;
              const cacheReadTokens = tokenType === 'cacheRead' ? value : 0;
              const cacheCreationTokens = tokenType === 'cacheCreation' ? value : 0;
              
              updateSessionCost.run(0, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, sessionId);
            } else if (sessionId && metricName === 'conversation.message.cost') {
              // Handle message cost metric
              const messageId = attrs.message_id || attrs['message.id'];
              const conversationId = attrs.conversation_id || attrs['conversation.id'];
              const role = attrs.role || attrs['message.role'];
              const model = attrs.model || attrs['message.model'];
              const cost = value;
              
              if (messageId) {
                // Try to insert the message (will be updated with tokens later)
                try {
                  insertMessage.run(
                    messageId,
                    sessionId,
                    conversationId || null,
                    role || null,
                    model || null,
                    cost,
                    0, // input_tokens - will be updated
                    0, // output_tokens - will be updated
                    0, // cache_creation_tokens - will be updated
                    0  // cache_read_tokens - will be updated
                  );
                } catch (e) {
                  // Message might already exist, that's ok
                }
              }
            } else if (metricName === 'conversation.message.tokens') {
              // Handle message token metric
              const messageId = attrs.message_id || attrs['message.id'];
              const tokenType = attrs.type || attrs['token.type'];
              
              if (messageId && tokenType) {
                const inputTokens = tokenType === 'input' ? value : 0;
                const outputTokens = tokenType === 'output' ? value : 0;
                const cacheReadTokens = tokenType === 'cache_read' ? value : 0;
                const cacheCreationTokens = tokenType === 'cache_creation' ? value : 0;
                
                // Update message tokens
                updateMessageTokens.run(inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, messageId);
              }
            }

            insertMetric.run(
              metric.sum.isMonotonic ? "counter" : "gauge",
              metricName,
              value,
              JSON.stringify({ ...resourceAttrs, ...attrs }),
              attrs.project_path || resourceAttrs.project_path || null,
              userId || attrs.user_account_uuid || resourceAttrs.user_account_uuid || null,
              sessionId || resourceAttrs.session_id || null,
              JSON.stringify({
                timestamp: dp.timeUnixNano,
                service: resourceAttrs['service.name'] || "claude-code",
              })
            );
          }
        } else if (metric.gauge) {
          // Gauge
          const dataPoints = metric.gauge.dataPoints || [];
          for (const dp of dataPoints) {
            const attrs = extractAttributes(dp.attributes || []);
            const value = dp.asInt || dp.asDouble || 0;

            insertMetric.run(
              "gauge",
              metricName,
              value,
              JSON.stringify({ ...resourceAttrs, ...attrs }),
              attrs.project_path || resourceAttrs.project_path || null,
              attrs.user_account_uuid ||
                resourceAttrs.user_account_uuid ||
                null,
              attrs.session_id || resourceAttrs.session_id || null,
              JSON.stringify({
                timestamp: dp.timeUnixNano,
                service: resourceAttrs['service.name'] || "claude-code",
              })
            );
          }
        } else if (metric.histogram) {
          // Histogram
          const dataPoints = metric.histogram.dataPoints || [];
          for (const dp of dataPoints) {
            const attrs = extractAttributes(dp.attributes || []);

            // Store histogram summary statistics
            insertMetric.run(
              "histogram",
              metricName,
              dp.sum || 0,
              JSON.stringify({
                ...resourceAttrs,
                ...attrs,
                count: dp.count,
                min: dp.min,
                max: dp.max,
              }),
              attrs.project_path || resourceAttrs.project_path || null,
              attrs.user_account_uuid ||
                resourceAttrs.user_account_uuid ||
                null,
              attrs.session_id || resourceAttrs.session_id || null,
              JSON.stringify({
                timestamp: dp.timeUnixNano,
                service: resourceAttrs['service.name'] || "claude-code",
                buckets: dp.bucketCounts,
                exemplars: dp.exemplars,
              })
            );
          }
        }
      }
    }
  }
}