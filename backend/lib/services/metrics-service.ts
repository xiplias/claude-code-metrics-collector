import { insertMetric } from "../database";
import { db } from "../database";

export interface MetricData {
  metric_type?: string;
  metric_name: string;
  metric_value?: number;
  labels?: Record<string, any>;
  project_path?: string;
  user_id?: string;
  session_id?: string;
  metadata?: Record<string, any>;
}

export interface MetricsListParams {
  limit: number;
  offset: number;
}

export function recordMetric(data: MetricData): void {
  insertMetric.run(
    data.metric_type || "counter",
    data.metric_name,
    data.metric_value || 1,
    JSON.stringify(data.labels || {}),
    data.project_path || null,
    data.user_id || null,
    data.session_id || null,
    JSON.stringify(data.metadata || {})
  );
}

export function getMetrics(params: MetricsListParams) {
  return db
    .query(
      `
      SELECT * FROM metrics 
      ORDER BY timestamp DESC 
      LIMIT ? OFFSET ?
    `
    )
    .all(params.limit, params.offset);
}

export function validateMetricData(data: any): { isValid: boolean; error?: string } {
  if (!data.metric_name) {
    return { isValid: false, error: "metric_name is required" };
  }

  if (data.metric_value !== undefined && typeof data.metric_value !== "number") {
    return { isValid: false, error: "metric_value must be a number" };
  }

  return { isValid: true };
}

export function parseMetricData(data: any): MetricData {
  return {
    metric_type: data.metric_type,
    metric_name: data.metric_name,
    metric_value: data.metric_value,
    labels: data.labels,
    project_path: data.project_path,
    user_id: data.user_id,
    session_id: data.session_id,
    metadata: data.metadata,
  };
}