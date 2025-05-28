import { Database } from 'bun:sqlite';

const db = new Database('claude-metrics.db');

console.log('Recent request logs for /v1/metrics:');
const logs = db.query(`
  SELECT endpoint, response_status, error_message, timestamp
  FROM request_logs 
  WHERE endpoint = '/v1/metrics'
  ORDER BY timestamp DESC 
  LIMIT 10
`).all();
console.table(logs);

db.close();