import { describe, it, expect, beforeEach } from "bun:test";
import { 
  createMessageData, 
  extractMessageInfo, 
  updateMessageInfo, 
  addMessageCost, 
  addMessageTokens, 
  messageDataToSessionCosts, 
  saveMessage,
  MessageData 
} from "../../../backend/lib/message-processor-test";
import { SessionData } from "../../../backend/lib/session-processor-test";
import { testDb } from "../../../backend/lib/test-database";

describe("Message Processor", () => {
  beforeEach(() => {
    // Clean up test data
    testDb.exec("DELETE FROM messages WHERE message_id LIKE 'test-msg-%'");
    testDb.exec("DELETE FROM sessions WHERE session_id LIKE 'test-session-%'");
  });

  describe("createMessageData", () => {
    it("should create empty message data with defaults", () => {
      const messageData = createMessageData();
      
      expect(messageData.messageId).toBeNull();
      expect(messageData.conversationId).toBeNull();
      expect(messageData.role).toBeNull();
      expect(messageData.model).toBeNull();
      expect(messageData.totalCost).toBe(0);
      expect(messageData.inputTokens).toBe(0);
      expect(messageData.outputTokens).toBe(0);
      expect(messageData.cacheReadTokens).toBe(0);
      expect(messageData.cacheCreationTokens).toBe(0);
      expect(messageData.timestamp).toBeGreaterThan(0);
    });
  });

  describe("extractMessageInfo", () => {
    it("should extract message info from attributes", () => {
      const attrs = {
        'message_id': 'test-msg-001',
        'conversation_id': 'test-conv-001',
        'role': 'assistant',
        'model': 'claude-3-sonnet'
      };

      const messageInfo = extractMessageInfo(attrs);
      
      expect(messageInfo.messageId).toBe('test-msg-001');
      expect(messageInfo.conversationId).toBe('test-conv-001');
      expect(messageInfo.role).toBe('assistant');
      expect(messageInfo.model).toBe('claude-3-sonnet');
    });

    it("should handle alternative attribute names", () => {
      const attrs = {
        'message.id': 'test-msg-002',
        'conversation.id': 'test-conv-002',
        'message.role': 'user',
        'message.model': 'claude-3-haiku'
      };

      const messageInfo = extractMessageInfo(attrs);
      
      expect(messageInfo.messageId).toBe('test-msg-002');
      expect(messageInfo.conversationId).toBe('test-conv-002');
      expect(messageInfo.role).toBe('user');
      expect(messageInfo.model).toBe('claude-3-haiku');
    });

    it("should handle missing attributes", () => {
      const messageInfo = extractMessageInfo({});
      
      expect(messageInfo.messageId).toBeNull();
      expect(messageInfo.conversationId).toBeNull();
      expect(messageInfo.role).toBeNull();
      expect(messageInfo.model).toBeNull();
    });
  });

  describe("updateMessageInfo", () => {
    it("should update message data with new info", () => {
      const messageData = createMessageData();
      const newInfo = {
        messageId: 'test-msg-003',
        conversationId: 'test-conv-003',
        role: 'assistant',
        model: 'claude-3-opus'
      };

      updateMessageInfo(messageData, newInfo);
      
      expect(messageData.messageId).toBe('test-msg-003');
      expect(messageData.conversationId).toBe('test-conv-003');
      expect(messageData.role).toBe('assistant');
      expect(messageData.model).toBe('claude-3-opus');
    });

    it("should not overwrite existing values", () => {
      const messageData = createMessageData();
      messageData.messageId = 'existing-msg';
      messageData.role = 'existing-role';

      const newInfo = {
        messageId: 'new-msg',
        conversationId: 'new-conv',
        role: 'new-role',
        model: 'new-model'
      };

      updateMessageInfo(messageData, newInfo);
      
      expect(messageData.messageId).toBe('existing-msg');
      expect(messageData.role).toBe('existing-role');
      expect(messageData.conversationId).toBe('new-conv');
      expect(messageData.model).toBe('new-model');
    });
  });

  describe("addMessageCost", () => {
    it("should add cost to message", () => {
      const messageData = createMessageData();
      
      addMessageCost(messageData, 0.05);
      expect(messageData.totalCost).toBe(0.05);
      
      addMessageCost(messageData, 0.03);
      expect(messageData.totalCost).toBe(0.08);
    });
  });

  describe("addMessageTokens", () => {
    it("should add input tokens", () => {
      const messageData = createMessageData();
      
      addMessageTokens(messageData, 100, 'input');
      expect(messageData.inputTokens).toBe(100);
      
      addMessageTokens(messageData, 50, 'input');
      expect(messageData.inputTokens).toBe(150);
    });

    it("should add output tokens", () => {
      const messageData = createMessageData();
      
      addMessageTokens(messageData, 200, 'output');
      expect(messageData.outputTokens).toBe(200);
    });

    it("should add cache read tokens", () => {
      const messageData = createMessageData();
      
      addMessageTokens(messageData, 1000, 'cache_read');
      expect(messageData.cacheReadTokens).toBe(1000);
      
      addMessageTokens(messageData, 500, 'cacheRead');
      expect(messageData.cacheReadTokens).toBe(1500);
    });

    it("should add cache creation tokens", () => {
      const messageData = createMessageData();
      
      addMessageTokens(messageData, 300, 'cache_creation');
      expect(messageData.cacheCreationTokens).toBe(300);
      
      addMessageTokens(messageData, 200, 'cacheCreation');
      expect(messageData.cacheCreationTokens).toBe(500);
    });

    it("should ignore unknown token types", () => {
      const messageData = createMessageData();
      
      addMessageTokens(messageData, 100, 'unknown_type');
      expect(messageData.inputTokens).toBe(0);
      expect(messageData.outputTokens).toBe(0);
      expect(messageData.cacheReadTokens).toBe(0);
      expect(messageData.cacheCreationTokens).toBe(0);
    });
  });

  describe("messageDataToSessionCosts", () => {
    it("should convert message data to session costs", () => {
      const messageData = createMessageData();
      messageData.totalCost = 0.15;
      messageData.inputTokens = 1000;
      messageData.outputTokens = 500;
      messageData.cacheReadTokens = 2000;
      messageData.cacheCreationTokens = 100;

      const sessionCosts = messageDataToSessionCosts(messageData);
      
      expect(sessionCosts.totalCost).toBe(0.15);
      expect(sessionCosts.inputTokens).toBe(1000);
      expect(sessionCosts.outputTokens).toBe(500);
      expect(sessionCosts.cacheReadTokens).toBe(2000);
      expect(sessionCosts.cacheCreationTokens).toBe(100);
    });
  });

  describe("saveMessage", () => {
    beforeEach(() => {
      // Create test session
      testDb.exec(`
        INSERT INTO sessions (session_id, user_id, user_email, organization_id, model)
        VALUES ('test-session-msg-001', 'test-user-001', 'test@example.com', 'test-org-001', 'claude-3-sonnet')
      `);
    });

    it("should save new message to database", () => {
      const messageData: MessageData = {
        messageId: 'test-msg-save-001',
        conversationId: 'test-conv-save-001',
        role: 'assistant',
        model: 'claude-3-sonnet',
        totalCost: 0.08,
        inputTokens: 800,
        outputTokens: 400,
        cacheReadTokens: 1500,
        cacheCreationTokens: 75,
        timestamp: Date.now()
      };

      const sessionData: SessionData = {
        sessionId: 'test-session-msg-001',
        userId: 'test-user-001',
        userEmail: 'test@example.com',
        orgId: 'test-org-001',
        model: 'claude-3-sonnet'
      };

      const result = saveMessage(messageData, sessionData);
      expect(result).toBe(true);

      const savedMessage = testDb.query("SELECT * FROM messages WHERE message_id = ?")
        .get('test-msg-save-001');
      expect(savedMessage).toBeTruthy();
      expect(savedMessage.session_id).toBe('test-session-msg-001');
      expect(savedMessage.cost).toBe(0.08);
      expect(savedMessage.input_tokens).toBe(800);
    });

    it("should update existing message", () => {
      const messageData: MessageData = {
        messageId: 'test-msg-update-001',
        conversationId: 'test-conv-update-001',
        role: 'assistant',
        model: 'claude-3-sonnet',
        totalCost: 0.05,
        inputTokens: 500,
        outputTokens: 250,
        cacheReadTokens: 1000,
        cacheCreationTokens: 50,
        timestamp: Date.now()
      };

      const sessionData: SessionData = {
        sessionId: 'test-session-msg-001',
        userId: 'test-user-001',
        userEmail: 'test@example.com',
        orgId: 'test-org-001',
        model: 'claude-3-sonnet'
      };

      // Save first time
      saveMessage(messageData, sessionData);

      // Update with additional costs
      messageData.totalCost = 0.03;
      messageData.inputTokens = 300;
      messageData.outputTokens = 150;

      const result = saveMessage(messageData, sessionData);
      expect(result).toBe(true);

      const savedMessage = testDb.query("SELECT * FROM messages WHERE message_id = ?")
        .get('test-msg-update-001');
      expect(savedMessage.cost).toBe(0.08); // 0.05 + 0.03
      expect(savedMessage.input_tokens).toBe(800); // 500 + 300
      expect(savedMessage.output_tokens).toBe(400); // 250 + 150
    });

    it("should return false when sessionId is missing", () => {
      const messageData: MessageData = {
        messageId: 'test-msg-fail-001',
        conversationId: 'test-conv-fail-001',
        role: 'assistant',
        model: 'claude-3-sonnet',
        totalCost: 0.08,
        inputTokens: 800,
        outputTokens: 400,
        cacheReadTokens: 1500,
        cacheCreationTokens: 75,
        timestamp: Date.now()
      };

      const sessionData: SessionData = {
        sessionId: null,
        userId: 'test-user-001',
        userEmail: 'test@example.com',
        orgId: 'test-org-001',
        model: 'claude-3-sonnet'
      };

      const result = saveMessage(messageData, sessionData);
      expect(result).toBe(false);
    });

    it("should return false when messageId is missing", () => {
      const messageData: MessageData = {
        messageId: null,
        conversationId: 'test-conv-fail-002',
        role: 'assistant',
        model: 'claude-3-sonnet',
        totalCost: 0.08,
        inputTokens: 800,
        outputTokens: 400,
        cacheReadTokens: 1500,
        cacheCreationTokens: 75,
        timestamp: Date.now()
      };

      const sessionData: SessionData = {
        sessionId: 'test-session-msg-001',
        userId: 'test-user-001',
        userEmail: 'test@example.com',
        orgId: 'test-org-001',
        model: 'claude-3-sonnet'
      };

      const result = saveMessage(messageData, sessionData);
      expect(result).toBe(false);
    });
  });
});