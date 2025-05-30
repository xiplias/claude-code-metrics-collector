import { 
  testDb,
  testInsertMetric, 
  testUpsertSession, 
  testUpdateSessionCost, 
  testInsertMessage
} from "./test-database";
import { extractAttributes } from "./utils";

interface MessageData {
  sessionId: string | null;
  userId: string | null;
  userEmail: string | null;
  orgId: string | null;
  model: string | null;
  messageId: string | null;
  conversationId: string | null;
  role: string | null;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  timestamp: number;
}

// Process OTLP metrics data with test database - simple approach
export function processOTLPMetricsTest(data: any) {
  const resourceMetrics = data.resourceMetrics || [];
  
  // Process each resourceMetrics as a message
  for (const rm of resourceMetrics) {
    processMessage(rm);
  }
}

function processMessage(resourceMetric: any) {
  // Initialize message data
  const messageData: MessageData = {
    sessionId: null,
    userId: null,
    userEmail: null,
    orgId: null,
    model: null,
    messageId: null,
    conversationId: null,
    role: null,
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    timestamp: Date.now()
  };
  
  // Extract resource attributes
  const resourceAttrs = extractAttributes(resourceMetric.resource?.attributes || []);
  
  // Get session info from resource attributes first
  messageData.sessionId = resourceAttrs['session_id'];
  messageData.userId = resourceAttrs['user_id'];
  
  // Process all metrics in this message
  const scopeMetrics = resourceMetric.scopeMetrics || [];
  
  for (const sm of scopeMetrics) {
    const metrics = sm.metrics || [];
    
    for (const metric of metrics) {
      processMetric(metric, messageData, resourceAttrs);
    }
  }
  
  // Create or update session if we have session data
  if (messageData.sessionId) {
    testUpsertSession.run(
      messageData.sessionId,
      messageData.userId,
      messageData.userEmail,
      messageData.orgId,
      messageData.model
    );
    
    // Update session aggregates
    testUpdateSessionCost.run(
      messageData.totalCost,
      messageData.inputTokens,
      messageData.outputTokens,
      messageData.cacheReadTokens,
      messageData.cacheCreationTokens,
      messageData.sessionId
    );
  }
  
  // Save message if we have both session and message IDs
  if (messageData.sessionId && messageData.messageId) {
    try {
      testInsertMessage.run(
        messageData.messageId,
        messageData.sessionId,
        messageData.conversationId,
        messageData.role,
        messageData.model,
        messageData.totalCost,
        messageData.inputTokens,
        messageData.outputTokens,
        messageData.cacheCreationTokens,
        messageData.cacheReadTokens
      );
    } catch (e: any) {
      // Update existing message
      const updateMessage = testDb.prepare(`
        UPDATE messages 
        SET cost = cost + ?,
            input_tokens = input_tokens + ?,
            output_tokens = output_tokens + ?,
            cache_creation_tokens = cache_creation_tokens + ?,
            cache_read_tokens = cache_read_tokens + ?
        WHERE message_id = ?
      `);
      updateMessage.run(
        messageData.totalCost,
        messageData.inputTokens,
        messageData.outputTokens,
        messageData.cacheCreationTokens,
        messageData.cacheReadTokens,
        messageData.messageId
      );
    }
  }
}

function processMetric(metric: any, messageData: MessageData, resourceAttrs: Record<string, any>) {
  const metricName = metric.name;
  const metricType = getMetricType(metric);
  
  // Get data points based on metric type
  let dataPoints: any[] = [];
  if (metric.sum) {
    dataPoints = metric.sum.dataPoints || [];
  } else if (metric.gauge) {
    dataPoints = metric.gauge.dataPoints || [];
  } else if (metric.histogram) {
    dataPoints = metric.histogram.dataPoints || [];
  }
  
  // Process each data point
  for (const dp of dataPoints) {
    const value = extractValue(dp);
    const dpAttrs = extractAttributes(dp.attributes || []);
    
    // Extract session info from data point if not found in resource
    if (!messageData.sessionId && dpAttrs['session.id']) {
      messageData.sessionId = dpAttrs['session.id'];
    }
    if (!messageData.userId && dpAttrs['user.id']) {
      messageData.userId = dpAttrs['user.id'];
    }
    if (!messageData.userEmail && dpAttrs['user.email']) {
      messageData.userEmail = dpAttrs['user.email'];
    }
    if (!messageData.orgId && dpAttrs['organization.id']) {
      messageData.orgId = dpAttrs['organization.id'];
    }
    if (!messageData.model && dpAttrs['model']) {
      messageData.model = dpAttrs['model'];
    }
    
    // Process based on metric name
    if (metricName === 'claude_code.cost.usage') {
      messageData.totalCost += value;
    } else if (metricName === 'claude_code.token.usage') {
      const tokenType = dpAttrs['type'];
      switch (tokenType) {
        case 'input':
          messageData.inputTokens += value;
          break;
        case 'output':
          messageData.outputTokens += value;
          break;
        case 'cacheRead':
          messageData.cacheReadTokens += value;
          break;
        case 'cacheCreation':
          messageData.cacheCreationTokens += value;
          break;
      }
    } else if (metricName === 'conversation.message.cost') {
      messageData.totalCost += value;
      // Extract message-specific info
      messageData.messageId = dpAttrs['message_id'] || dpAttrs['message.id'];
      messageData.conversationId = dpAttrs['conversation_id'] || dpAttrs['conversation.id'];
      messageData.role = dpAttrs['role'] || dpAttrs['message.role'];
    } else if (metricName === 'conversation.message.tokens') {
      const tokenType = dpAttrs['type'] || dpAttrs['token.type'];
      switch (tokenType) {
        case 'input':
          messageData.inputTokens += value;
          break;
        case 'output':
          messageData.outputTokens += value;
          break;
        case 'cache_read':
        case 'cacheRead':
          messageData.cacheReadTokens += value;
          break;
        case 'cache_creation':
        case 'cacheCreation':
          messageData.cacheCreationTokens += value;
          break;
      }
      // Extract message-specific info if not already set
      if (!messageData.messageId) {
        messageData.messageId = dpAttrs['message_id'] || dpAttrs['message.id'];
      }
      if (!messageData.conversationId) {
        messageData.conversationId = dpAttrs['conversation_id'] || dpAttrs['conversation.id'];
      }
      if (!messageData.role) {
        messageData.role = dpAttrs['role'] || dpAttrs['message.role'];
      }
    }
    
    // Store the raw metric with message association
    const labels = { ...resourceAttrs, ...dpAttrs };
    if (messageData.messageId && !labels.message_id && !labels['message.id']) {
      labels.message_id = messageData.messageId;
    }
    
    testInsertMetric.run(
      metricType,
      metricName,
      value,
      JSON.stringify(labels),
      dpAttrs['project_path'] || resourceAttrs['project_path'] || null,
      messageData.userId || dpAttrs['user.id'] || dpAttrs['user_id'] || null,
      messageData.sessionId || dpAttrs['session_id'] || null,
      JSON.stringify({
        timestamp: dp.timeUnixNano,
        service: resourceAttrs['service.name'] || "claude-code",
      })
    );
  }
}

// Helper functions
function getMetricType(metric: any): string {
  if (metric.sum) {
    return metric.sum.isMonotonic ? "counter" : "gauge";
  } else if (metric.gauge) {
    return "gauge";
  } else if (metric.histogram) {
    return "histogram";
  }
  return "unknown";
}

function extractValue(dataPoint: any): number {
  if (dataPoint.asInt !== undefined) {
    return parseInt(dataPoint.asInt, 10);
  }
  return dataPoint.asDouble || 0;
}