import { Database } from 'bun:sqlite';

const db = new Database('claude-metrics.db');

console.log('Database schema:');
const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables:', tables.map(t => t.name).join(', '));

console.log('\nMetrics table schema:');
const metricsSchema = db.query("PRAGMA table_info(metrics)").all();
console.table(metricsSchema);

console.log('\nMessages table schema:');
const messagesSchema = db.query("PRAGMA table_info(messages)").all();
console.table(messagesSchema);

db.close();