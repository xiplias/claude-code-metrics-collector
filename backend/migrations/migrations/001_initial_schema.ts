import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // Create metrics table
  await db.schema
    .createTable('metrics')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('metric_type', 'text', (col) => col.notNull())
    .addColumn('metric_name', 'text', (col) => col.notNull())
    .addColumn('metric_value', 'real')
    .addColumn('labels', 'text')
    .addColumn('project_path', 'text')
    .addColumn('user_id', 'text')
    .addColumn('session_id', 'text')
    .addColumn('metadata', 'text')
    .execute();

  // Create events table
  await db.schema
    .createTable('events')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('event_type', 'text', (col) => col.notNull())
    .addColumn('event_name', 'text', (col) => col.notNull())
    .addColumn('project_path', 'text')
    .addColumn('user_id', 'text')
    .addColumn('session_id', 'text')
    .addColumn('duration_ms', 'integer')
    .addColumn('metadata', 'text')
    .execute();

  // Create request_logs table
  await db.schema
    .createTable('request_logs')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('endpoint', 'text', (col) => col.notNull())
    .addColumn('method', 'text', (col) => col.notNull())
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('request_body', 'text')
    .addColumn('response_status', 'integer')
    .addColumn('response_time_ms', 'integer')
    .addColumn('error_message', 'text')
    .addColumn('extracted_data', 'text')
    .execute();

  // Create sessions table
  await db.schema
    .createTable('sessions')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('session_id', 'text', (col) => col.notNull().unique())
    .addColumn('user_id', 'text')
    .addColumn('user_email', 'text')
    .addColumn('organization_id', 'text')
    .addColumn('model', 'text')
    .addColumn('total_cost', 'real', (col) => col.defaultTo(0))
    .addColumn('total_input_tokens', 'integer', (col) => col.defaultTo(0))
    .addColumn('total_output_tokens', 'integer', (col) => col.defaultTo(0))
    .addColumn('total_cache_read_tokens', 'integer', (col) => col.defaultTo(0))
    .addColumn('total_cache_creation_tokens', 'integer', (col) => col.defaultTo(0))
    .addColumn('first_seen', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('last_seen', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute();

  // Create messages table
  await db.schema
    .createTable('messages')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('message_id', 'text', (col) => col.notNull().unique())
    .addColumn('session_id', 'text', (col) => col.notNull())
    .addColumn('conversation_id', 'text')
    .addColumn('role', 'text')
    .addColumn('model', 'text')
    .addColumn('cost', 'real', (col) => col.defaultTo(0))
    .addColumn('input_tokens', 'integer', (col) => col.defaultTo(0))
    .addColumn('output_tokens', 'integer', (col) => col.defaultTo(0))
    .addColumn('cache_creation_tokens', 'integer', (col) => col.defaultTo(0))
    .addColumn('cache_read_tokens', 'integer', (col) => col.defaultTo(0))
    .addColumn('timestamp', 'timestamp', (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
    .addForeignKeyConstraint('fk_session_id', ['session_id'], 'sessions', ['session_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('messages').ifExists().execute();
  await db.schema.dropTable('sessions').ifExists().execute();
  await db.schema.dropTable('request_logs').ifExists().execute();
  await db.schema.dropTable('events').ifExists().execute();
  await db.schema.dropTable('metrics').ifExists().execute();
}