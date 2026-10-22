import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import { demo } from "@/lib/demo-data";
import type {
  Deployment,
  EvaluationRun,
  InferenceInput,
  InferenceResult,
  MetricsSummary,
  Model,
  RegisterModelInput,
  Sourced,
  TimeRange,
  TimeseriesPoint,
} from "@/types/api";

/**
 * Every read tries the live backend first and falls back to the demo provider,
 * reporting where the data came from so the UI can label it.
 */
async function withFallback<T>(live: () => Promise<T>, demoFn: () => Promise<T>): Promise<Sourced<T>> {
  try {
    return { data: await live(), source: "live" };
  } catch {
    return { data: await demoFn(), source: "demo" };
  }
}

export const connectionQuery = queryOptions({
  queryKey: ["connection"],
  queryFn: async () => {
    try {
      const health = await api.health();
      return { status: "connected" as const, health };
    } catch {
      return { status: "disconnected" as const, health: null };
    }
  },
  refetchInterval: 15_000,
  staleTime: 5_000,
});

export const modelsQuery = queryOptions({
  queryKey: ["models"],
  queryFn: () => withFallback<Model[]>(() => api.listModels(), demo.listModels),
});

export const modelQuery = (id: string) =>
  queryOptions({
    queryKey: ["models", id],
    queryFn: () => withFallback<Model>(() => api.getModel(id), () => demo.getModel(id)),
  });

export const requestsQuery = queryOptions({
  queryKey: ["requests"],
  queryFn: () => withFallback(() => api.listRequests(), demo.listRequests),
});

export const metricsSummaryQuery = (range: TimeRange) =>
  queryOptions({
    queryKey: ["metrics", "summary", range],
    queryFn: () => withFallback<MetricsSummary>(() => api.metricsSummary(range), () => demo.metricsSummary(range)),
  });

export const metricsTimeseriesQuery = (range: TimeRange, modelId?: string) =>
  queryOptions({
    queryKey: ["metrics", "timeseries", range, modelId ?? "all"],
    queryFn: () =>
      withFallback<TimeseriesPoint[]>(
        () => api.metricsTimeseries(range, modelId),
        () => demo.metricsTimeseries(range, modelId),
      ),
  });

export const evaluationsQuery = queryOptions({
  queryKey: ["evaluations"],
  queryFn: () => withFallback<EvaluationRun[]>(api.listEvaluations, demo.listEvaluations),
});

export const deploymentsQuery = queryOptions({
  queryKey: ["deployments"],
  queryFn: () => withFallback<Deployment[]>(api.listDeployments, demo.listDeployments),
});

/** Mutations: try live, fall back to demo so the UI stays usable offline. */
export async function createModel(input: RegisterModelInput): Promise<Sourced<Model>> {
  return withFallback(() => api.createModel(input), () => demo.createModel(input));
}

export async function runInference(input: InferenceInput): Promise<Sourced<InferenceResult>> {
  try {
    return { data: await api.runInference(input), source: "live" };
  } catch (e) {
    try {
      return { data: await demo.runInference(input), source: "demo" };
    } catch {
      throw e;
    }
  }
}

export const demoMutations = {
  registerVersion: demo.registerVersion,
  activateVersion: demo.activateVersion,
  rollback: demo.rollback,
  startEvaluation: demo.startEvaluation,
  retryDeployment: demo.retryDeployment,
  rollbackDeployment: demo.rollbackDeployment,
};
