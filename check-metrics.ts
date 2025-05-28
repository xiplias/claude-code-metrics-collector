import { Database } from 'bun:sqlite';

const db = new Database('claude-metrics.db');

console.log('Recent metrics with message in name:');
const metrics = db.query(`
  SELECT metric_name, metric_value, labels, timestamp 
  FROM metrics 
  WHERE metric_name LIKE '%message%'
  ORDER BY timestamp DESC 
  LIMIT 20
`).all();

console.table(metrics.map(m => ({
  ...m,
  labels: JSON.parse(m.labels)
})));

console.log('\nUnique metric names containing "message":');
const uniqueMetrics = db.query(`
  SELECT DISTINCT metric_name, COUNT(*) as count
  FROM metrics 
  WHERE metric_name LIKE '%message%'
  GROUP BY metric_name
`).all();
console.table(uniqueMetrics);

console.log('\nAll unique metric names:');
const allMetrics = db.query(`
  SELECT DISTINCT metric_name, COUNT(*) as count
  FROM metrics 
  GROUP BY metric_name
  ORDER BY count DESC
  LIMIT 20
`).all();
console.table(allMetrics);

db.close();