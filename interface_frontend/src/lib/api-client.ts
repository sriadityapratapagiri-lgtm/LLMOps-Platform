import { getApiBaseUrl } from "@/lib/config";
import type {
  Deployment,
  EvaluationRun,
  HealthResponse,
  InferenceInput,
  InferenceRequest,
  InferenceResult,
  MetricsSummary,
  Model,
  RegisterModelInput,
  TimeRange,
  TimeseriesPoint,
} from "@/types/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 10_000, baseUrl?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const url = `${(baseUrl ?? getApiBaseUrl()).replace(/\/+$/, "")}${path}`;
  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    if (!res.ok) {
      let detail = res.statusText;
      try {
        const body = (await res.json()) as { detail?: string };
        if (body.detail) detail = body.detail;
      } catch {
        /* non-JSON body */
      }
      throw new ApiError(`${res.status} ${detail}`, res.status);
    }
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === "AbortError") throw new ApiError("Request timed out", 408);
    throw new ApiError("Backend unreachable", 0);
  } finally {
    clearTimeout(timer);
  }
}

const qs = (params: Record<string, string | undefined>) => {
  const s = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  return s ? `?${s}` : "";
};

// ─── Backend raw types (what the API actually returns) ───────────────────────

interface BackendModel {
  model_id: string;
  model_version: string;
  provider: string;
  status: string;
  description: string | null;
  created_at: string;
}

interface BackendModelsResponse {
  models: BackendModel[];
}

interface BackendModelResponse {
  model: BackendModel;
}

interface BackendInferenceResult {
  request_id: string;
  model_id: string;
  model_version: string;
  generated_text: string;
  latency_ms: number;
  input_tokens: number;
  output_tokens: number;
}

interface BackendRequest {
  request_id: string;
  model_id: string;
  model_version: string;
  prompt: string;
  generated_text: string | null;
  status: string;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  error_message: string | null;
  created_at: string;
}

interface BackendRequestsResponse {
  total: number;
  limit: number;
  offset: number;
  requests: BackendRequest[];
}

// ─── Adapters (backend → frontend types) ─────────────────────────────────────

function adaptModel(m: BackendModel): Model {
  return {
    id: m.model_id,
    displayName: m.model_id,          // Use model_id as display name; no separate field in DB
    provider: "custom",               // Backend stores any string; map to "custom" for type safety
    modelIdentifier: m.model_id,
    description: m.description ?? "",
    endpointUrl: null,
    status: m.status === "ready" ? "deployed" : "not_deployed",
    latestVersion: m.model_version,
    activeVersion: m.status === "ready" ? m.model_version : null,
    versions: [
      {
        version: m.model_version,
        createdAt: m.created_at,
        notes: m.description ?? "",
        isActive: m.status === "ready",
        contextWindow: 4096,
        quantization: null,
        defaultTemperature: 0.7,
        defaultMaxTokens: 512,
      },
    ],
    createdAt: m.created_at,
    updatedAt: m.created_at,
    tags: [m.provider],
  };
}

function adaptRequest(r: BackendRequest): InferenceRequest {
  return {
    id: r.request_id,
    traceId: r.request_id,
    modelId: r.model_id,
    modelName: r.model_id,
    version: r.model_version,
    status: (r.status as "success" | "failed" | "timeout") ?? "failed",
    latencyMs: r.latency_ms ?? 0,
    ttftMs: null,
    queueMs: null,
    inferenceMs: r.latency_ms,
    inputTokens: r.input_tokens ?? 0,
    outputTokens: r.output_tokens ?? 0,
    timestamp: r.created_at,
    errorType: r.error_message ? "Error" : null,
    errorMessage: r.error_message,
    stackTrace: null,
    params: { temperature: 0.7, maxTokens: 100, topP: 0.95 },
    prompt: r.prompt,
    response: r.generated_text,
    events: [],
  };
}

// ─── Public API client ────────────────────────────────────────────────────────

export const api = {
  health: (baseUrl?: string) => request<HealthResponse>("/health", {}, 3000, baseUrl),

  listModels: async (): Promise<Model[]> => {
    const data = await request<BackendModelsResponse>("/api/v1/models");
    return data.models.map(adaptModel);
  },

  getModel: async (id: string): Promise<Model> => {
    const data = await request<BackendModel>(`/api/v1/models/${encodeURIComponent(id)}`);
    return adaptModel(data);
  },

  createModel: async (input: RegisterModelInput): Promise<Model> => {
    const payload = {
      model_id: input.modelIdentifier.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-|-$/g, ""),
      model_version: input.version,
      provider: input.provider,
      description: input.description,
    };
    const data = await request<BackendModelResponse>("/api/v1/models", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return adaptModel(data.model);
  },

  listRequests: async (): Promise<InferenceRequest[]> => {
    const data = await request<BackendRequestsResponse>("/api/v1/requests?limit=100&offset=0");
    return data.requests.map(adaptRequest);
  },

  getRequest: async (id: string): Promise<InferenceRequest> => {
    // Backend has no individual request endpoint; look through the list.
    const data = await request<BackendRequestsResponse>("/api/v1/requests?limit=100&offset=0");
    const row = data.requests.find((r) => r.request_id === id);
    if (!row) throw new ApiError(`Request ${id} not found`, 404);
    return adaptRequest(row);
  },

  runInference: async (input: InferenceInput): Promise<InferenceResult> => {
    const payload = {
      model_id: input.modelId,
      prompt: input.systemPrompt ? `${input.systemPrompt}\n\n${input.prompt}` : input.prompt,
      max_tokens: Math.min(input.maxTokens, 2048),
    };
    const data = await request<BackendInferenceResult>(
      "/api/v1/inference",
      { method: "POST", body: JSON.stringify(payload) },
      input.timeoutMs ?? 60_000,
    );
    return {
      requestId: data.request_id,
      modelId: data.model_id,
      version: data.model_version,
      output: data.generated_text,
      ttftMs: null,
      latencyMs: data.latency_ms,
      inputTokens: data.input_tokens,
      outputTokens: data.output_tokens,
      simulated: true,   // Backend uses mock inference, always label simulated
    };
  },

  metricsSummary: async (range: TimeRange): Promise<MetricsSummary> => {
    return request<MetricsSummary>(`/api/v1/metrics/summary${qs({ range })}`);
  },

  metricsTimeseries: async (range: TimeRange, modelId?: string): Promise<TimeseriesPoint[]> => {
    return request<TimeseriesPoint[]>(`/api/v1/metrics/timeseries${qs({ range, model_id: modelId })}`);
  },

  // Not yet implemented on the backend; these will trigger demo fallback.
  listEvaluations: (): Promise<EvaluationRun[]> => request<EvaluationRun[]>("/api/v1/evaluations"),
  listDeployments: (): Promise<Deployment[]> => request<Deployment[]>("/api/v1/deployments"),
};
