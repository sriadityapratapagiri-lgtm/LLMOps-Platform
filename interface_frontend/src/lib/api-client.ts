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

export const api = {
  health: (baseUrl?: string) => request<HealthResponse>("/health", {}, 3000, baseUrl),
  listModels: () => request<Model[]>("/api/v1/models"),
  getModel: (id: string) => request<Model>(`/api/v1/models/${encodeURIComponent(id)}`),
  createModel: (input: RegisterModelInput) =>
    request<Model>("/api/v1/models", { method: "POST", body: JSON.stringify(input) }),
  listRequests: () => request<InferenceRequest[]>("/api/v1/requests"),
  getRequest: (id: string) => request<InferenceRequest>(`/api/v1/requests/${encodeURIComponent(id)}`),
  runInference: (input: InferenceInput) =>
    request<InferenceResult>(
      "/api/v1/inference",
      { method: "POST", body: JSON.stringify(input) },
      input.timeoutMs ?? 60_000,
    ),
  metricsSummary: (range: TimeRange) => request<MetricsSummary>(`/api/v1/metrics/summary${qs({ range })}`),
  metricsTimeseries: (range: TimeRange, modelId?: string) =>
    request<TimeseriesPoint[]>(`/api/v1/metrics/timeseries${qs({ range, model_id: modelId })}`),
  listEvaluations: () => request<EvaluationRun[]>("/api/v1/evaluations"),
  listDeployments: () => request<Deployment[]>("/api/v1/deployments"),
};
