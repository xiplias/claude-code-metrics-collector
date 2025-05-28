import { Database } from 'bun:sqlite';

const db = new Database('claude-metrics.db');

console.log('Messages table content:');
const messages = db.query('SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10').all();
console.table(messages);

console.log('\nTotal message count:');
const count = db.query('SELECT COUNT(*) as count FROM messages').get();
console.log(count);

console.log('\nMessage count by session:');
const sessionCounts = db.query('SELECT session_id, COUNT(*) as message_count FROM messages GROUP BY session_id').all();
console.table(sessionCounts);

db.close();