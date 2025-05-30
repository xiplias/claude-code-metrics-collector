import { db } from "../database";

export interface SessionsListParams {
  limit: number;
  offset: number;
}

export interface SessionDetailData {
  session: any;
  messages: any[];
  events: any[];
  metrics: any[];
}

export function getSessions(params: SessionsListParams) {
  return db
    .query(
      `
      SELECT * FROM sessions
      ORDER BY last_seen DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(params.limit, params.offset);
}

export function getSessionById(sessionId: string): any | null {
  return db
    .query(`SELECT * FROM sessions WHERE session_id = ?`)
    .get(sessionId);
}

export function getSessionMessages(sessionId: string, params: { limit?: number; offset?: number } = {}) {
  const limit = params.limit || 20;
  const offset = params.offset || 0;

  // Get total count
  const totalResult = db
    .query(`SELECT COUNT(*) as count FROM messages WHERE session_id = ?`)
    .get(sessionId) as { count: number };
  
  const total = totalResult.count;

  // Get paginated messages (newest first for better UX)
  const messages = db
    .query(
      `
      SELECT * FROM messages
      WHERE session_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `
    )
    .all(sessionId, limit, offset);

  // Enhance messages with their associated metrics
  const enhancedMessages = messages.map((message, index) => {
    // Find metrics that reference this message directly
    const directMessageMetrics = db
      .query(
        `
        SELECT * FROM metrics 
        WHERE session_id = ? 
        AND (
          JSON_EXTRACT(labels, '$.message_id') = ? OR 
          JSON_EXTRACT(labels, '$."message.id"') = ?
        )
        ORDER BY timestamp DESC
      `
      )
      .all(sessionId, (message as any).message_id, (message as any).message_id);

    // Extract unique metric types for this message
    const metricTypes = [...new Set(directMessageMetrics.map((m: any) => m.metric_name))];

    // Check for code-related activities
    const codeEditDecisions = directMessageMetrics.filter((m: any) => 
      m.metric_name === 'claude_code.code_edit_tool.decision'
    );
    
    const linesOfCodeMetrics = directMessageMetrics.filter((m: any) => 
      m.metric_name === 'claude_code.lines_of_code.count'
    );

    // Analyze code changes
    const hasCodeChanges = linesOfCodeMetrics.length > 0;
    const hasFileOperations = codeEditDecisions.length > 0;
    const acceptedFileOps = codeEditDecisions.filter((m: any) => {
      try {
        const labels = JSON.parse(m.labels || '{}');
        return labels.decision === 'accept';
      } catch {
        return false;
      }
    });

    // Calculate total lines changed
    const totalLinesAdded = linesOfCodeMetrics
      .filter((m: any) => {
        try {
          const labels = JSON.parse(m.labels || '{}');
          return labels.type === 'added';
        } catch {
          return false;
        }
      })
      .reduce((sum: number, m: any) => sum + (m.metric_value || 0), 0);

    const totalLinesRemoved = linesOfCodeMetrics
      .filter((m: any) => {
        try {
          const labels = JSON.parse(m.labels || '{}');
          return labels.type === 'removed';
        } catch {
          return false;
        }
      })
      .reduce((sum: number, m: any) => sum + (m.metric_value || 0), 0);

    // Get tool names used
    const toolsUsed = acceptedFileOps.map((m: any) => {
      try {
        const labels = JSON.parse(m.labels || '{}');
        return labels.tool_name;
      } catch {
        return null;
      }
    }).filter(Boolean);

    return {
      ...message,
      metric_types: metricTypes,
      code_activity: {
        has_code_changes: hasCodeChanges,
        has_file_operations: hasFileOperations,
        total_lines_added: totalLinesAdded,
        total_lines_removed: totalLinesRemoved,
        tools_used: [...new Set(toolsUsed)],
        file_operations_count: acceptedFileOps.length
      }
    };
  });

  return {
    messages: enhancedMessages,
    total,
    hasMore: offset + limit < total,
  };
}

export function getSessionEvents(sessionId: string) {
  return db
    .query(
      `
      SELECT * FROM events
      WHERE session_id = ?
      ORDER BY timestamp ASC
    `
    )
    .all(sessionId);
}

export function getSessionMetrics(sessionId: string) {
  return db
    .query(
      `
      SELECT * FROM metrics
      WHERE session_id = ?
      ORDER BY timestamp DESC
    `
    )
    .all(sessionId);
}

export function getSessionDetails(sessionId: string): SessionDetailData | null {
  const session = getSessionById(sessionId);
  
  if (!session) {
    return null;
  }

  const messagesResult = getSessionMessages(sessionId);
  const events = getSessionEvents(sessionId);
  const metrics = getSessionMetrics(sessionId);

  // Extract messages array from paginated result
  const messages = messagesResult.messages;

  // Enhance messages with their associated metrics
  const enhancedMessages = messages.map((message, index) => {
    // Find metrics that reference this message directly
    const directMessageMetrics = metrics.filter(metric => {
      try {
        const labels = JSON.parse(metric.labels || '{}');
        return labels.message_id === message.message_id || labels['message.id'] === message.message_id;
      } catch {
        return false;
      }
    });

    // If no direct message metrics, find metrics recorded around the same time
    // Get the time window between this message and the next (or 5 seconds for the last message)
    const messageTime = new Date(message.timestamp).getTime();
    const nextMessageTime = index < messages.length - 1 
      ? new Date(messages[index + 1].timestamp).getTime()
      : messageTime + 5000; // 5 seconds window for last message

    const timeWindowMetrics = directMessageMetrics.length === 0 
      ? metrics.filter(metric => {
          const metricTime = new Date(metric.timestamp).getTime();
          return metricTime >= messageTime && metricTime < nextMessageTime;
        })
      : directMessageMetrics;

    // Extract unique metric types for this message
    const metricTypes = [...new Set(timeWindowMetrics.map(m => m.metric_name))];

    return {
      ...message,
      metric_types: metricTypes
    };
  });

  return {
    session,
    messages: enhancedMessages,
    events,
    metrics,
  };
}