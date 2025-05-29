import { Database } from "bun:sqlite";

// Test database setup (separate from main database)
export function createTestDatabase() {
  const db = new Database(":memory:"); // In-memory database for tests

  // Create the same tables as main database
  db.run(`
    CREATE TABLE IF NOT EXISTS metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      metric_type TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      metric_value REAL,
      labels TEXT,
      project_path TEXT,
      user_id TEXT,
      session_id TEXT,
      metadata TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      event_type TEXT NOT NULL,
      event_name TEXT NOT NULL,
      project_path TEXT,
      user_id TEXT,
      session_id TEXT,
      duration_ms INTEGER,
      metadata TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS request_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      endpoint TEXT NOT NULL,
      method TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      request_body TEXT,
      response_status INTEGER,
      response_time_ms INTEGER,
      error_message TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      user_id TEXT,
      user_email TEXT,
      organization_id TEXT,
      model TEXT,
      total_cost REAL DEFAULT 0,
      total_input_tokens INTEGER DEFAULT 0,
      total_output_tokens INTEGER DEFAULT 0,
      total_cache_read_tokens INTEGER DEFAULT 0,
      total_cache_creation_tokens INTEGER DEFAULT 0,
      first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      message_id TEXT UNIQUE NOT NULL,
      session_id TEXT NOT NULL,
      conversation_id TEXT,
      role TEXT,
      model TEXT,
      cost REAL DEFAULT 0,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      cache_creation_tokens INTEGER DEFAULT 0,
      cache_read_tokens INTEGER DEFAULT 0,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(session_id)
    )
  `);

  // Create prepared statements
  const insertMetric = db.prepare(`
    INSERT INTO metrics (metric_type, metric_name, metric_value, labels, project_path, user_id, session_id, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertEvent = db.prepare(`
    INSERT INTO events (event_type, event_name, project_path, user_id, session_id, duration_ms, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const upsertSession = db.prepare(`
    INSERT INTO sessions (session_id, user_id, user_email, organization_id, model)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      last_seen = CURRENT_TIMESTAMP
  `);

  const updateSessionCost = db.prepare(`
    UPDATE sessions 
    SET total_cost = total_cost + ?,
        total_input_tokens = total_input_tokens + ?,
        total_output_tokens = total_output_tokens + ?,
        total_cache_read_tokens = total_cache_read_tokens + ?,
        total_cache_creation_tokens = total_cache_creation_tokens + ?,
        last_seen = CURRENT_TIMESTAMP
    WHERE session_id = ?
  `);

  const insertMessage = db.prepare(`
    INSERT INTO messages (message_id, session_id, conversation_id, role, model, cost, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const updateMessageTokens = db.prepare(`
    UPDATE messages 
    SET input_tokens = input_tokens + ?,
        output_tokens = output_tokens + ?,
        cache_read_tokens = cache_read_tokens + ?,
        cache_creation_tokens = cache_creation_tokens + ?
    WHERE message_id = ?
  `);

  return {
    db,
    insertMetric,
    insertEvent,
    upsertSession,
    updateSessionCost,
    insertMessage,
    updateMessageTokens
  };
}