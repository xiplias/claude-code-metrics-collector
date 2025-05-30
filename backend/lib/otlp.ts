import { extractAttributes } from "./utils";
import { 
  extractSessionData, 
  updateSessionData, 
  processSession,
  SessionData 
} from "./session-processor";
import { 
  createMessageData, 
  saveMessage, 
  messageDataToSessionCosts 
} from "./message-processor";
import { 
  getMetricType, 
  extractDataPoints, 
  processDataPoint, 
  storeRawMetric, 
  processMetricDataPoint 
} from "./metric-processor";

// Process OTLP metrics data - modular approach
export function processOTLPMetrics(data: any) {
  const resourceMetrics = data.resourceMetrics || [];
  
  // Process each resourceMetrics as a message
  for (const rm of resourceMetrics) {
    processResourceMetrics(rm);
  }
}

function processResourceMetrics(resourceMetric: any) {
  // Extract resource attributes and initial session data
  const resourceAttrs = extractAttributes(resourceMetric.resource?.attributes || []);
  let sessionData = extractSessionData(resourceAttrs);
  const messageData = createMessageData();
  
  // Process all metrics in this resource
  const scopeMetrics = resourceMetric.scopeMetrics || [];
  
  for (const sm of scopeMetrics) {
    const metrics = sm.metrics || [];
    
    for (const metric of metrics) {
      sessionData = processMetric(metric, messageData, sessionData, resourceAttrs);
    }
  }
  
  // Save session and message if we have the required data
  if (sessionData.sessionId) {
    const sessionCosts = messageDataToSessionCosts(messageData);
    processSession(sessionData, sessionCosts);
    
    if (messageData.messageId) {
      saveMessage(messageData, sessionData);
    } else if (messageData.totalCost > 0 || messageData.inputTokens > 0 || messageData.outputTokens > 0) {
      // Create a synthetic message for session-level costs without explicit message_id
      // This ensures we capture all activity even when message-level metrics aren't sent
      const syntheticMessageData = {
        ...messageData,
        messageId: `synthetic-${sessionData.sessionId}-${Date.now()}`,
        role: messageData.role || 'assistant',
        conversationId: messageData.conversationId || sessionData.sessionId
      };
      saveMessage(syntheticMessageData, sessionData);
    }
  }
}

function processMetric(
  metric: any, 
  messageData: any, 
  sessionData: SessionData, 
  resourceAttrs: Record<string, any>
): SessionData {
  const metricName = metric.name;
  const metricType = getMetricType(metric);
  const dataPoints = extractDataPoints(metric);
  
  let updatedSessionData = sessionData;
  
  // Process each data point
  for (const dp of dataPoints) {
    const dataPointInfo = processDataPoint(dp);
    
    // Process the data point for session/message updates
    updatedSessionData = processMetricDataPoint(
      metricName, 
      dataPointInfo, 
      messageData, 
      updatedSessionData
    );
    
    // Store the raw metric with message association
    storeRawMetric(metricName, metricType, dataPointInfo, resourceAttrs, updatedSessionData, messageData);
  }
  
  return updatedSessionData;
}