import { processOTLPMetrics } from "../otlp";

export interface OTLPProcessingResult {
  success: boolean;
  error?: string;
}

export function validateOTLPContentType(contentType: string): { isValid: boolean; error?: string } {
  if (contentType.includes("application/x-protobuf")) {
    return {
      isValid: false,
      error: "Protobuf format not yet supported. Please use JSON format by setting OTEL_EXPORTER_OTLP_PROTOCOL=http/json"
    };
  }
  return { isValid: true };
}

export async function parseOTLPData(req: Request): Promise<any> {
  return await req.json();
}

export function processOTLPData(data: any): OTLPProcessingResult {
  try {
    processOTLPMetrics(data);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}