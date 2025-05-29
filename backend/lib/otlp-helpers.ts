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
  return dataPoint.asInt || dataPoint.asDouble || dataPoint.sum || 0;
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