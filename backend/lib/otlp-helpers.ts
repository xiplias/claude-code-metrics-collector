import { extractAttributes } from "./utils";

// Extract session information from attributes (both datapoint and resource)
export function extractSessionInfo(dpAttributes: any[], resourceAttributes: any[]) {
  const attrs = extractAttributes(dpAttributes);
  const resourceAttrs = extractAttributes(resourceAttributes);
  
  return {
    sessionId: attrs['session.id'] || attrs.session_id || resourceAttrs['session.id'] || resourceAttrs.session_id,
    userId: attrs['user.id'] || attrs.user_id || resourceAttrs['user.id'] || resourceAttrs.user_id,
    userEmail: attrs['user.email'] || resourceAttrs['user.email'],
    orgId: attrs['organization.id'] || resourceAttrs['organization.id'],
    model: attrs.model || resourceAttrs.model,
    attrs,
    resourceAttrs
  };
}

// Parse token metrics based on type
export function parseTokenMetric(value: number, tokenType: string) {
  return {
    inputTokens: tokenType === 'input' ? value : 0,
    outputTokens: tokenType === 'output' ? value : 0,
    cacheReadTokens: tokenType === 'cache_read' || tokenType === 'cacheRead' ? value : 0,
    cacheCreationTokens: tokenType === 'cache_creation' || tokenType === 'cacheCreation' ? value : 0,
  };
}

// Parse message information from attributes
export function parseMessageInfo(attrs: Record<string, any>) {
  return {
    messageId: attrs.message_id || attrs['message.id'],
    conversationId: attrs.conversation_id || attrs['conversation.id'],
    role: attrs.role || attrs['message.role'],
    model: attrs.model || attrs['message.model'],
  };
}

// Determine metric type string for database storage
export function getMetricType(metric: any): string {
  if (metric.sum) {
    return metric.sum.isMonotonic ? "counter" : "gauge";
  } else if (metric.gauge) {
    return "gauge";
  } else if (metric.histogram) {
    return "histogram";
  }
  return "unknown";
}

// Extract metric value from datapoint
export function extractMetricValue(dataPoint: any): number {
  if (dataPoint.asInt !== undefined) {
    return parseInt(dataPoint.asInt, 10);
  }
  return dataPoint.asDouble || dataPoint.sum || 0;
}

// Check if a metric should trigger session processing
export function shouldProcessSession(metricName: string): boolean {
  return metricName === 'claude_code.cost.usage' || 
         metricName === 'claude_code.token.usage' || 
         metricName === 'conversation.message.cost' ||
         metricName === 'conversation.message.tokens';
}

// Check if a metric is a message-related metric
export function isMessageMetric(metricName: string): boolean {
  return metricName === 'conversation.message.cost' || 
         metricName === 'conversation.message.tokens';
}

// Extract key data from OTLP metrics for logging
export function extractOTLPData(data: any) {
  const extracted: any = {
    metrics: [],
    sessions: new Set(),
    users: new Set(),
    models: new Set(),
    totalCost: 0,
    totalTokens: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheCreation: 0
    },
    totalLinesOfCode: 0
  };

  const resourceMetrics = data.resourceMetrics || [];

  for (const rm of resourceMetrics) {
    const resourceAttrs = extractAttributes(rm.resource?.attributes || []);
    const scopeMetrics = rm.scopeMetrics || [];

    for (const sm of scopeMetrics) {
      const metrics = sm.metrics || [];

      for (const metric of metrics) {
        const metricName = metric.name;
        extracted.metrics.push(metricName);

        // Process data points for sum metrics
        if (metric.sum) {
          const dataPoints = metric.sum.dataPoints || [];
          for (const dp of dataPoints) {
            const value = extractMetricValue(dp);
            const sessionInfo = extractSessionInfo(dp.attributes || [], rm.resource?.attributes || []);
            
            if (sessionInfo.sessionId) {
              extracted.sessions.add(sessionInfo.sessionId);
            }
            if (sessionInfo.userId) {
              extracted.users.add(sessionInfo.userId);
            }
            if (sessionInfo.model) {
              extracted.models.add(sessionInfo.model);
            }

            // Track costs, tokens, and lines of code
            if (metricName === 'claude_code.cost.usage') {
              extracted.totalCost += value;
            } else if (metricName === 'claude_code.token.usage') {
              const tokenType = sessionInfo.attrs.type;
              const tokens = parseTokenMetric(value, tokenType);
              extracted.totalTokens.input += tokens.inputTokens;
              extracted.totalTokens.output += tokens.outputTokens;
              extracted.totalTokens.cacheRead += tokens.cacheReadTokens;
              extracted.totalTokens.cacheCreation += tokens.cacheCreationTokens;
            } else if (metricName === 'claude_code.lines_of_code.count') {
              extracted.totalLinesOfCode += value;
            }
          }
        }
      }
    }
  }

  return {
    uniqueMetrics: [...new Set(extracted.metrics)],
    sessionCount: extracted.sessions.size,
    sessions: [...extracted.sessions],
    userCount: extracted.users.size,
    models: [...extracted.models],
    totalCost: extracted.totalCost,
    totalTokens: extracted.totalTokens,
    totalLinesOfCode: extracted.totalLinesOfCode
  };
}