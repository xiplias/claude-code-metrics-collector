import { testInsertMetric } from "./test-database";
import { extractAttributes } from "./utils";
import { SessionData } from "./session-processor-test";
import { MessageData, extractMessageInfo, updateMessageInfo, addMessageCost, addMessageTokens } from "./message-processor-test";

export interface DataPointInfo {
  value: number;
  attributes: Record<string, any>;
  timestamp: string;
}

// Extract value from OTLP data point
export function extractDataPointValue(dataPoint: any): number {
  if (dataPoint.asInt !== undefined) {
    return parseInt(dataPoint.asInt, 10);
  }
  return dataPoint.asDouble || 0;
}

// Determine metric type from OTLP metric structure
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

// Extract data points from metric based on type
export function extractDataPoints(metric: any): any[] {
  if (metric.sum) {
    return metric.sum.dataPoints || [];
  } else if (metric.gauge) {
    return metric.gauge.dataPoints || [];
  } else if (metric.histogram) {
    return metric.histogram.dataPoints || [];
  }
  return [];
}

// Process data point and extract info
export function processDataPoint(dataPoint: any): DataPointInfo {
  return {
    value: extractDataPointValue(dataPoint),
    attributes: extractAttributes(dataPoint.attributes || []),
    timestamp: dataPoint.timeUnixNano || String(Date.now() * 1000000)
  };
}

// Store raw metric in database
export function storeRawMetric(
  metricName: string,
  metricType: string,
  dataPointInfo: DataPointInfo,
  resourceAttrs: Record<string, any>,
  sessionData: SessionData,
  messageData?: MessageData
): void {
  // If we have a message being processed, include its ID in the labels
  const labels = { ...resourceAttrs, ...dataPointInfo.attributes };
  if (messageData?.messageId && !labels.message_id && !labels['message.id']) {
    labels.message_id = messageData.messageId;
  }
  
  testInsertMetric.run(
    metricType,
    metricName,
    dataPointInfo.value,
    JSON.stringify(labels),
    dataPointInfo.attributes['project_path'] || resourceAttrs['project_path'] || null,
    sessionData.userId || dataPointInfo.attributes['user.id'] || dataPointInfo.attributes['user_id'] || null,
    sessionData.sessionId || dataPointInfo.attributes['session_id'] || null,
    JSON.stringify({
      timestamp: dataPointInfo.timestamp,
      service: resourceAttrs['service.name'] || "claude-code",
    })
  );
}

// Process claude_code.cost.usage metric
export function processSessionCostMetric(dataPointInfo: DataPointInfo, messageData: MessageData): void {
  addMessageCost(messageData, dataPointInfo.value);
}

// Process claude_code.token.usage metric
export function processSessionTokenMetric(dataPointInfo: DataPointInfo, messageData: MessageData): void {
  const tokenType = dataPointInfo.attributes['type'];
  if (tokenType) {
    addMessageTokens(messageData, dataPointInfo.value, tokenType);
  }
}

// Process conversation.message.cost metric
export function processMessageCostMetric(dataPointInfo: DataPointInfo, messageData: MessageData): void {
  addMessageCost(messageData, dataPointInfo.value);
  const messageInfo = extractMessageInfo(dataPointInfo.attributes);
  updateMessageInfo(messageData, messageInfo);
}

// Process conversation.message.tokens metric
export function processMessageTokenMetric(dataPointInfo: DataPointInfo, messageData: MessageData): void {
  const tokenType = dataPointInfo.attributes['type'] || dataPointInfo.attributes['token.type'];
  if (tokenType) {
    addMessageTokens(messageData, dataPointInfo.value, tokenType);
  }
  const messageInfo = extractMessageInfo(dataPointInfo.attributes);
  updateMessageInfo(messageData, messageInfo);
}

// Process individual metric data point based on metric name
export function processMetricDataPoint(
  metricName: string,
  dataPointInfo: DataPointInfo,
  messageData: MessageData,
  sessionData: SessionData
): SessionData {
  // Extract additional session info from data point if not already set
  const dpSessionData = {
    sessionId: dataPointInfo.attributes['session.id'] || null,
    userId: dataPointInfo.attributes['user.id'] || null,
    userEmail: dataPointInfo.attributes['user.email'] || null,
    orgId: dataPointInfo.attributes['organization.id'] || null,
    model: dataPointInfo.attributes['model'] || null
  };

  // Update session data with data point info if not already set
  const updatedSessionData = {
    sessionId: sessionData.sessionId || dpSessionData.sessionId,
    userId: sessionData.userId || dpSessionData.userId,
    userEmail: sessionData.userEmail || dpSessionData.userEmail,
    orgId: sessionData.orgId || dpSessionData.orgId,
    model: sessionData.model || dpSessionData.model
  };

  // Process based on metric name
  switch (metricName) {
    case 'claude_code.cost.usage':
      processSessionCostMetric(dataPointInfo, messageData);
      break;
    case 'claude_code.token.usage':
      processSessionTokenMetric(dataPointInfo, messageData);
      break;
    case 'conversation.message.cost':
      processMessageCostMetric(dataPointInfo, messageData);
      break;
    case 'conversation.message.tokens':
      processMessageTokenMetric(dataPointInfo, messageData);
      break;
    // Other metrics don't affect message/session data but are still stored
  }

  return updatedSessionData;
}