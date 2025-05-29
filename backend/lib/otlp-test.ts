import { 
  testDb,
  testInsertMetric, 
  testUpsertSession, 
  testUpdateSessionCost, 
  testInsertMessage, 
  testUpdateMessageTokens 
} from "./test-database";
import { extractAttributes } from "./utils";
import {
  extractSessionInfo,
  parseTokenMetric,
  parseMessageInfo,
  getMetricType,
  extractMetricValue,
  shouldProcessSession,
  isMessageMetric
} from "./otlp-helpers";

// Process OTLP metrics data with test database
export function processOTLPMetricsTest(data: any) {
  const resourceMetrics = data.resourceMetrics || [];

  // Each resourceMetrics represents a message in a session
  for (const rm of resourceMetrics) {
    const resourceAttrs = extractAttributes(rm.resource?.attributes || []);
    
    // Extract session info from resource attributes
    const sessionInfo = extractSessionInfo([], rm.resource?.attributes || []);
    let { sessionId, userId, userEmail, orgId, model } = sessionInfo;
    
    // Create/update session if we have session data
    if (sessionId) {
      testUpsertSession.run(sessionId, userId, userEmail, orgId, model);
    }
    
    // Variables to collect message data
    let messageId: string | null = null;
    let conversationId: string | null = null;
    let role: string | null = null;
    let messageModel: string | null = null;
    let totalCost = 0;
    let inputTokens = 0;
    let outputTokens = 0;
    let cacheReadTokens = 0;
    let cacheCreationTokens = 0;
    
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
            const value = extractMetricValue(dp);
            const attrs = extractAttributes(dp.attributes || []);

            // Process different metric types
            if (metricName === 'claude_code.cost.usage') {
              // Extract session info from data point attributes
              const dpSessionInfo = extractSessionInfo(dp.attributes || [], rm.resource?.attributes || []);
              const dpSessionId = dpSessionInfo.sessionId || sessionId;
              
              // Session-level cost - add to message cost and session total
              totalCost += value;
              if (dpSessionId) {
                // Update the session variable if we found it in data point
                if (!sessionId && dpSessionId) {
                  sessionId = dpSessionId;
                  // Also create/update session
                  testUpsertSession.run(dpSessionId, dpSessionInfo.userId || userId, dpSessionInfo.userEmail || userEmail, dpSessionInfo.orgId || orgId, dpSessionInfo.model || model);
                }
                testUpdateSessionCost.run(value, 0, 0, 0, 0, dpSessionId);
              }
            } else if (metricName === 'claude_code.token.usage') {
              // Extract session info from data point attributes
              const dpSessionInfo = extractSessionInfo(dp.attributes || [], rm.resource?.attributes || []);
              const dpSessionId = dpSessionInfo.sessionId || sessionId;
              
              // Session-level tokens - add to message tokens and session total
              const tokenType = attrs.type;
              const tokens = parseTokenMetric(value, tokenType);
              inputTokens += tokens.inputTokens;
              outputTokens += tokens.outputTokens;
              cacheReadTokens += tokens.cacheReadTokens;
              cacheCreationTokens += tokens.cacheCreationTokens;
              
              if (dpSessionId) {
                // Update the session variable if we found it in data point
                if (!sessionId && dpSessionId) {
                  sessionId = dpSessionId;
                  // Also create/update session
                  testUpsertSession.run(dpSessionId, dpSessionInfo.userId || userId, dpSessionInfo.userEmail || userEmail, dpSessionInfo.orgId || orgId, dpSessionInfo.model || model);
                }
                testUpdateSessionCost.run(0, tokens.inputTokens, tokens.outputTokens, tokens.cacheReadTokens, tokens.cacheCreationTokens, dpSessionId);
              }
            } else if (metricName === 'conversation.message.cost') {
              // Message-specific cost
              const messageInfo = parseMessageInfo(attrs);
              messageId = messageInfo.messageId;
              conversationId = messageInfo.conversationId;
              role = messageInfo.role;
              messageModel = messageInfo.model;
              totalCost += value;
            } else if (metricName === 'conversation.message.tokens') {
              // Message-specific tokens
              const messageInfo = parseMessageInfo(attrs);
              if (!messageId) messageId = messageInfo.messageId;
              const tokenType = attrs.type || attrs['token.type'];
              
              if (tokenType) {
                const tokens = parseTokenMetric(value, tokenType);
                inputTokens += tokens.inputTokens;
                outputTokens += tokens.outputTokens;
                cacheReadTokens += tokens.cacheReadTokens;
                cacheCreationTokens += tokens.cacheCreationTokens;
              }
            }

            // Always insert the raw metric
            testInsertMetric.run(
              getMetricType(metric),
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
            const value = extractMetricValue(dp);

            testInsertMetric.run(
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
            testInsertMetric.run(
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
    
    // After processing all metrics in this resourceMetrics, save the message
    if (sessionId && messageId) {
      try {
        testInsertMessage.run(
          messageId,
          sessionId,
          conversationId,
          role,
          messageModel || model,
          totalCost,
          inputTokens,
          outputTokens,
          cacheCreationTokens,
          cacheReadTokens
        );
      } catch (e: any) {
        // If message already exists, update it with the accumulated values
        const updateMessage = testDb.prepare(`
          UPDATE messages 
          SET cost = cost + ?,
              input_tokens = input_tokens + ?,
              output_tokens = output_tokens + ?,
              cache_creation_tokens = cache_creation_tokens + ?,
              cache_read_tokens = cache_read_tokens + ?
          WHERE message_id = ?
        `);
        updateMessage.run(totalCost, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, messageId);
      }
    }
  }
}