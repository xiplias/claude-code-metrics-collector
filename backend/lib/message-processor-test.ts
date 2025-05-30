import { testDb, testInsertMessage } from "./test-database";
import { SessionData, SessionCosts } from "./session-processor-test";

export interface MessageData {
  messageId: string | null;
  conversationId: string | null;
  role: string | null;
  model: string | null;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  timestamp: number;
}

// Create empty message data
export function createMessageData(): MessageData {
  return {
    messageId: null,
    conversationId: null,
    role: null,
    model: null,
    totalCost: 0,
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
    timestamp: Date.now()
  };
}

// Extract message-specific information from attributes
export function extractMessageInfo(attrs: Record<string, any>): Partial<MessageData> {
  return {
    messageId: attrs['message_id'] || attrs['message.id'] || null,
    conversationId: attrs['conversation_id'] || attrs['conversation.id'] || null,
    role: attrs['role'] || attrs['message.role'] || null,
    model: attrs['model'] || attrs['message.model'] || null
  };
}

// Update message data with extracted info, preserving existing values
export function updateMessageInfo(messageData: MessageData, newInfo: Partial<MessageData>): void {
  if (newInfo.messageId && !messageData.messageId) {
    messageData.messageId = newInfo.messageId;
  }
  if (newInfo.conversationId && !messageData.conversationId) {
    messageData.conversationId = newInfo.conversationId;
  }
  if (newInfo.role && !messageData.role) {
    messageData.role = newInfo.role;
  }
  if (newInfo.model && !messageData.model) {
    messageData.model = newInfo.model;
  }
}

// Add cost to message
export function addMessageCost(messageData: MessageData, cost: number): void {
  messageData.totalCost += cost;
}

// Add tokens to message based on type
export function addMessageTokens(messageData: MessageData, tokens: number, tokenType: string): void {
  switch (tokenType) {
    case 'input':
      messageData.inputTokens += tokens;
      break;
    case 'output':
      messageData.outputTokens += tokens;
      break;
    case 'cache_read':
    case 'cacheRead':
      messageData.cacheReadTokens += tokens;
      break;
    case 'cache_creation':
    case 'cacheCreation':
      messageData.cacheCreationTokens += tokens;
      break;
  }
}

// Convert message data to session costs format
export function messageDataToSessionCosts(messageData: MessageData): SessionCosts {
  return {
    totalCost: messageData.totalCost,
    inputTokens: messageData.inputTokens,
    outputTokens: messageData.outputTokens,
    cacheReadTokens: messageData.cacheReadTokens,
    cacheCreationTokens: messageData.cacheCreationTokens
  };
}

// Save message to database (insert or update)
export function saveMessage(messageData: MessageData, sessionData: SessionData): boolean {
  if (!sessionData.sessionId || !messageData.messageId) {
    return false;
  }

  try {
    testInsertMessage.run(
      messageData.messageId,
      sessionData.sessionId,
      messageData.conversationId,
      messageData.role,
      messageData.model || sessionData.model,
      messageData.totalCost,
      messageData.inputTokens,
      messageData.outputTokens,
      messageData.cacheCreationTokens,
      messageData.cacheReadTokens
    );
    return true;
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
    return true;
  }
}