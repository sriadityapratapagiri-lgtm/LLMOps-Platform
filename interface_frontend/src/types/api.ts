// Typed contracts shared by the API client and the demo data provider.
// These mirror the *proposed* FastAPI endpoints; adapt when the backend contract is final.

export type DataSource = "live" | "demo";
export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export type Provider = "local" | "openai_compatible" | "custom";
export type ModelStatus = "deployed" | "staging" | "not_deployed" | "failed";

export interface ModelVersion {
  version: string;
  createdAt: string;
  notes: string;
  isActive: boolean;
  contextWindow: number;
  quantization: string | null;
  defaultTemperature: number;
  defaultMaxTokens: number;
}

export interface Model {
  id: string;
  displayName: string;
  provider: Provider;
  modelIdentifier: string;
  description: string;
  endpointUrl: string | null;
  status: ModelStatus;
  latestVersion: string;
  activeVersion: string | null;
  versions: ModelVersion[];
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

export interface RegisterModelInput {
  displayName: string;
  provider: Provider;
  modelIdentifier: string;
  version: string;
  endpointUrl?: string;
  description: string;
  status: ModelStatus;
}

export type RequestStatus = "success" | "failed" | "timeout";

export interface RequestEvent {
  at: string;
  type: "received" | "queued" | "started" | "first_token" | "completed" | "error" | "timeout";
  message: string;
}

export interface InferenceRequest {
  id: string;
  traceId: string;
  modelId: string;
  modelName: string;
  version: string;
  status: RequestStatus;
  latencyMs: number;
  ttftMs: number | null;
  queueMs: number | null;
  inferenceMs: number | null;
  inputTokens: number;
  outputTokens: number;
  timestamp: string;
  errorType: string | null;
  errorMessage: string | null;
  stackTrace: string | null;
  params: { temperature: number; maxTokens: number; topP: number };
  prompt: string | null;
  response: string | null;
  events: RequestEvent[];
}

export type TimeRange = "15m" | "1h" | "24h" | "7d";

export interface TimeseriesPoint {
  t: string;
  requests: number;
  success: number;
  failed: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  inputTokens: number;
  outputTokens: number;
  byModel: Record<string, number>;
  tokensByModel: Record<string, { input: number; output: number }>;
}

export interface MetricsSummary {
  totalRequests: number;
  requestsChange: number;
  p95LatencyMs: number;
  p95Change: number;
  errorRate: number;
  errorRateChangePp: number;
  totalTokens: number;
  tokensChange: number;
  sparklines: { requests: number[]; latency: number[]; errors: number[]; tokens: number[] };
}

export type ComponentHealth = "healthy" | "degraded" | "offline";

export interface HealthResponse {
  status: "ok" | "degraded";
  version?: string;
  components?: { name: string; status: ComponentHealth }[];
}

export interface EvalMetrics {
  taskSuccess: number;
  factualCorrectness: number;
  hallucinationRate: number;
  toolCallAccuracy: number;
}

export interface EvalCase {
  id: string;
  input: string;
  expected: string;
  actual: string;
  reason: string;
}

export type EvalStatus = "running" | "completed" | "failed";

export interface EvaluationRun {
  id: string;
  dataset: string;
  modelId: string;
  modelName: string;
  version: string;
  totalCases: number;
  passed: number;
  failed: number;
  durationMs: number | null;
  startedAt: string;
  status: EvalStatus;
  metrics: EvalMetrics | null;
  failedCases: EvalCase[];
  simulated: boolean;
}

export type DeploymentState = "pending" | "deploying" | "healthy" | "failed" | "rolled_back";
export type Environment = "local" | "staging" | "production";

export interface Deployment {
  id: string;
  modelId: string;
  modelName: string;
  version: string;
  environment: Environment;
  status: DeploymentState;
  startedAt: string;
  durationMs: number | null;
  initiatedBy: string;
  logs: string[];
}

export interface InferenceInput {
  modelId: string;
  version: string;
  systemPrompt: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number | null;
}

export interface InferenceResult {
  requestId: string;
  modelId: string;
  version: string;
  output: string;
  ttftMs: number | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  simulated: boolean;
}

/** Wrapper so every UI surface knows where data came from. */
export interface Sourced<T> {
  data: T;
  source: DataSource;
}
