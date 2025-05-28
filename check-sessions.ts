import { Database } from 'bun:sqlite';

const db = new Database('claude-metrics.db');

console.log('Sessions table content:');
const sessions = db.query('SELECT * FROM sessions ORDER BY last_seen DESC LIMIT 10').all();
console.table(sessions);

console.log('\nTotal session count:');
const count = db.query('SELECT COUNT(*) as count FROM sessions').get();
console.log(count);

db.close();