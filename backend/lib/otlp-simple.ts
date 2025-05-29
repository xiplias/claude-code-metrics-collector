import { db } from "./database";
import { extractAttributes } from "./utils";

// Database prepared statements
const upsertSession = db.prepare(`
  INSERT INTO sessions (session_id, user_id, user_email, organization_id, model)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(session_id) DO UPDATE SET
    user_id = COALESCE(excluded.user_id, sessions.user_id),
    user_email = COALESCE(excluded.user_email, sessions.user_email),
    organization_id = COALESCE(excluded.organization_id, sessions.organization_id),
    model = COALESCE(excluded.model, sessions.model),
    last_seen = datetime('now')
`);

const insertMetric = db.prepare(`
  INSERT INTO metrics (metric_type, metric_name, metric_value, labels, project_path, user_id, session_id, metadata)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMessage = db.prepare(`
  INSERT INTO messages (session_id, message_id, conversation_id, role, model, cost, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateSessionCost = db.prepare(`
  UPDATE sessions SET 
    total_cost = total_cost + ?,
    total_input_tokens = total_input_tokens + ?,
    total_output_tokens = total_output_tokens + ?,
    total_cache_read_tokens = total_cache_read_tokens + ?,
    total_cache_creation_tokens = total_cache_creation_tokens + ?,
    last_seen = datetime('now')
  WHERE session_id = ?
`);

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

export function processOTLPPayloadSimple(data: any) {
  console.log('Processing OTLP payload with simple approach');
  
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
  
  // Process all metrics in this message
  const scopeMetrics = resourceMetric.scopeMetrics || [];
  
  for (const sm of scopeMetrics) {
    const metrics = sm.metrics || [];
    
    for (const metric of metrics) {
      processMetric(metric, messageData, resourceAttrs);
    }
  }
  
  // After processing all metrics, we should have session info
  if (!messageData.sessionId) {
    console.warn('No session ID found in message data:', messageData);
    return;
  }
  
  // Create or update session
  upsertSession.run(
    messageData.sessionId,
    messageData.userId,
    messageData.userEmail,
    messageData.orgId,
    messageData.model
  );
  
  // Generate message ID if not present
  const messageId = messageData.messageId || `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store message data
  insertMessage.run(
    messageData.sessionId,
    messageId,
    messageData.conversationId,
    messageData.role,
    messageData.model,
    messageData.totalCost,
    messageData.inputTokens,
    messageData.outputTokens,
    messageData.cacheCreationTokens,
    messageData.cacheReadTokens
  );
  
  // Update session aggregates
  updateSessionCost.run(
    messageData.totalCost,
    messageData.inputTokens,
    messageData.outputTokens,
    messageData.cacheReadTokens,
    messageData.cacheCreationTokens,
    messageData.sessionId
  );
  
  console.log('Processed message:', {
    sessionId: messageData.sessionId,
    messageId: messageId,
    cost: messageData.totalCost,
    tokens: {
      input: messageData.inputTokens,
      output: messageData.outputTokens,
      cacheRead: messageData.cacheReadTokens,
      cacheCreation: messageData.cacheCreationTokens
    }
  });
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
    
    // Extract session info from data point (this is where it lives in the example)
    if (!messageData.sessionId && dpAttrs['session.id']) {
      messageData.sessionId = dpAttrs['session.id'];
      messageData.userId = dpAttrs['user.id'];
      messageData.userEmail = dpAttrs['user.email'];
      messageData.orgId = dpAttrs['organization.id'];
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
      messageData.messageId = dpAttrs['message.id'] || dpAttrs['message_id'];
      messageData.conversationId = dpAttrs['conversation.id'] || dpAttrs['conversation_id'];
      messageData.role = dpAttrs['message.role'] || dpAttrs['role'];
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
      // Extract message-specific info
      messageData.messageId = dpAttrs['message.id'] || dpAttrs['message_id'] || messageData.messageId;
      messageData.conversationId = dpAttrs['conversation.id'] || dpAttrs['conversation_id'] || messageData.conversationId;
      messageData.role = dpAttrs['message.role'] || dpAttrs['role'] || messageData.role;
    }
    
    // Store the metric
    insertMetric.run(
      metricType,
      metricName,
      value,
      JSON.stringify({ ...resourceAttrs, ...dpAttrs }),
      dpAttrs['project_path'] || resourceAttrs['project_path'] || null,
      messageData.userId || dpAttrs['user.id'] || dpAttrs['user_id'] || null,
      messageData.sessionId,
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