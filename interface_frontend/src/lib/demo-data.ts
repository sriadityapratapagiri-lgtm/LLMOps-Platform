/**
 * Centralized DEMO data provider. Everything here is synthetic sample data for
 * frontend development — it is NOT measured from any real model or backend.
 */
import type {
  Deployment,
  EvalCase,
  EvaluationRun,
  InferenceInput,
  InferenceRequest,
  InferenceResult,
  MetricsSummary,
  Model,
  ModelVersion,
  RegisterModelInput,
  RequestStatus,
  TimeRange,
  TimeseriesPoint,
} from "@/types/api";

// ---------- deterministic randomness ----------
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const hex = (rnd: () => number, n: number) =>
  Array.from({ length: n }, () => Math.floor(rnd() * 16).toString(16)).join("");

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const anchor = () => Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

// ---------- models ----------
const v = (
  version: string,
  daysAgo: number,
  notes: string,
  isActive: boolean,
  contextWindow = 32768,
  quantization: string | null = null,
): ModelVersion => ({
  version,
  createdAt: iso(anchor() - daysAgo * DAY),
  notes,
  isActive,
  contextWindow,
  quantization,
  defaultTemperature: 0.7,
  defaultMaxTokens: 512,
});

function seedModels(): Model[] {
  const now = anchor();
  return [
    {
      id: "qwen2.5-1.5b-instruct",
      displayName: "Qwen2.5 1.5B Instruct",
      provider: "local",
      modelIdentifier: "Qwen/Qwen2.5-1.5B-Instruct",
      description: "Example entry. Small instruction-tuned model intended for local serving.",
      endpointUrl: null,
      status: "deployed",
      latestVersion: "v1.2.0",
      activeVersion: "v1.2.0",
      versions: [
        v("v1.2.0", 3, "Q4_K_M quantization, updated chat template", true, 32768, "Q4_K_M"),
        v("v1.1.0", 17, "Increased default context to 32k", false, 32768, "Q8_0"),
        v("v1.0.0", 41, "Initial registration", false, 8192, "Q8_0"),
      ],
      createdAt: iso(now - 41 * DAY),
      updatedAt: iso(now - 3 * DAY),
      tags: ["example", "local"],
    },
    {
      id: "llama-3.1-8b-instruct",
      displayName: "Llama 3.1 8B Instruct",
      provider: "openai_compatible",
      modelIdentifier: "meta-llama/Llama-3.1-8B-Instruct",
      description: "Placeholder entry for an external OpenAI-compatible endpoint. Not configured.",
      endpointUrl: "https://api.example.com/v1",
      status: "not_deployed",
      latestVersion: "v0.1.0",
      activeVersion: null,
      versions: [v("v0.1.0", 9, "Placeholder — endpoint not verified", false, 131072)],
      createdAt: iso(now - 9 * DAY),
      updatedAt: iso(now - 9 * DAY),
      tags: ["example", "placeholder"],
    },
    {
      id: "support-ft-qwen",
      displayName: "Support Assistant (fine-tuned)",
      provider: "custom",
      modelIdentifier: "acme/support-ft-qwen2.5-1.5b",
      description: "Example custom LoRA fine-tune for support tickets. Staging only.",
      endpointUrl: null,
      status: "staging",
      latestVersion: "v3.0.0",
      activeVersion: "v2.4.1",
      versions: [
        v("v3.0.0", 1, "Retrained on Q3 ticket export", false, 32768, "LoRA r=16"),
        v("v2.4.1", 12, "Fix tool-call formatting", true, 32768, "LoRA r=16"),
        v("v2.4.0", 20, "Added refund intents", false, 32768, "LoRA r=16"),
      ],
      createdAt: iso(now - 60 * DAY),
      updatedAt: iso(now - 1 * DAY),
      tags: ["example", "fine-tune"],
    },
    {
      id: "mock-echo",
      displayName: "Mock Echo",
      provider: "custom",
      modelIdentifier: "inference/mock-echo",
      description: "Deterministic test model that echoes input. Used for integration tests.",
      endpointUrl: null,
      status: "deployed",
      latestVersion: "v1.0.0",
      activeVersion: "v1.0.0",
      versions: [v("v1.0.0", 90, "Echo implementation", true, 4096)],
      createdAt: iso(now - 90 * DAY),
      updatedAt: iso(now - 90 * DAY),
      tags: ["test"],
    },
  ];
}

const MODEL_SHARE: Record<string, number> = {
  "qwen2.5-1.5b-instruct": 0.58,
  "support-ft-qwen": 0.27,
  "mock-echo": 0.15,
};
const MODEL_LATENCY: Record<string, number> = {
  "qwen2.5-1.5b-instruct": 1,
  "support-ft-qwen": 1.15,
  "mock-echo": 0.08,
};

// ---------- requests ----------
const PROMPTS = [
  "Summarize the following support ticket in two sentences.",
  "Extract the order ID and refund amount as JSON.",
  "Classify the sentiment of this review: positive, neutral or negative.",
  "Translate to German: The deployment completed successfully.",
  "Write a SQL query that returns the top 5 customers by revenue.",
  "Call the lookup_order tool for order 88213.",
];
const ERRORS: { type: string; status: RequestStatus; message: string }[] = [
  { type: "TimeoutError", status: "timeout", message: "Generation exceeded timeout of 30000 ms" },
  { type: "ContextLengthExceeded", status: "failed", message: "Prompt (34,102 tokens) exceeds context window (32,768)" },
  { type: "UpstreamError", status: "failed", message: "Model server returned 503 Service Unavailable" },
  { type: "ValidationError", status: "failed", message: "max_tokens must be <= 4096" },
];

function seedRequests(models: Model[]): InferenceRequest[] {
  const rnd = seeded(415);
  const now = anchor();
  const ids = Object.keys(MODEL_SHARE);
  const out: InferenceRequest[] = [];
  for (let i = 0; i < 640; i++) {
    // denser recent traffic so short ranges have data
    const ageMs = i < 80 ? rnd() * HOUR : i < 260 ? rnd() * DAY : rnd() * 7 * DAY;
    const ts = now - ageMs;
    const r = rnd();
    const modelId = (r < 0.58 ? ids[0] : r < 0.85 ? ids[1] : ids[2])!;
    const model = models.find((m) => m.id === modelId)!;
    const version = model.activeVersion ?? model.latestVersion;
    const err = rnd() < 0.045 ? ERRORS[Math.floor(rnd() * ERRORS.length)]! : null;
    const status: RequestStatus = err ? err.status : "success";
    const factor = MODEL_LATENCY[modelId] ?? 1;
    const base = (120 + rnd() * 380 + (rnd() < 0.06 ? 900 : 0)) * factor;
    const latencyMs = status === "timeout" ? 30000 : Math.round(base);
    const inputTokens = Math.round(40 + rnd() * 900);
    const outputTokens = status === "success" ? Math.round(20 + rnd() * 480) : 0;
    const ttft = status === "success" ? Math.round(latencyMs * (0.12 + rnd() * 0.15)) : null;
    const queue = Math.round(2 + rnd() * 20);
    const prompt = PROMPTS[Math.floor(rnd() * PROMPTS.length)]!;
    const id = `req_${hex(rnd, 12)}`;
    const t0 = ts - latencyMs;
    const events: InferenceRequest["events"] = [
      { at: iso(t0), type: "received", message: `POST /api/v1/inference model=${modelId}` },
      { at: iso(t0 + 1), type: "queued", message: "Queued on worker-0" },
      { at: iso(t0 + queue), type: "started", message: `Generation started (${version})` },
    ];
    if (ttft) events.push({ at: iso(t0 + queue + ttft), type: "first_token", message: "First token emitted" });
    events.push(
      err
        ? { at: iso(ts), type: err.status === "timeout" ? "timeout" : "error", message: err.message }
        : { at: iso(ts), type: "completed", message: `Completed with ${outputTokens} output tokens` },
    );
    out.push({
      id,
      traceId: `trc_${hex(rnd, 16)}`,
      modelId,
      modelName: model.displayName,
      version,
      status,
      latencyMs,
      ttftMs: ttft,
      queueMs: queue,
      inferenceMs: latencyMs - queue,
      inputTokens,
      outputTokens,
      timestamp: iso(ts),
      errorType: err?.type ?? null,
      errorMessage: err?.message ?? null,
      stackTrace: err
        ? `Traceback (most recent call last):\n  File "app/inference/runner.py", line 142, in generate\n    result = await engine.generate(request)\n  File "app/inference/engine.py", line 88, in generate\n    raise ${err.type}("${err.message}")\n${err.type}: ${err.message}`
        : null,
      params: { temperature: Math.round(rnd() * 10) / 10, maxTokens: 512, topP: 0.95 },
      prompt: `[demo prompt] ${prompt}`,
      response: status === "success" ? `[demo response] Synthetic output for "${prompt.slice(0, 40)}…"` : null,
      events,
    });
  }
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ---------- timeseries ----------
const RANGE_SPEC: Record<TimeRange, { points: number; stepMs: number }> = {
  "15m": { points: 15, stepMs: MIN },
  "1h": { points: 30, stepMs: 2 * MIN },
  "24h": { points: 48, stepMs: 30 * MIN },
  "7d": { points: 42, stepMs: 4 * HOUR },
};

export function generateTimeseries(range: TimeRange, modelId?: string, offsetPeriods = 0): TimeseriesPoint[] {
  const { points, stepMs } = RANGE_SPEC[range];
  const rnd = seeded(hashString(`${range}:${offsetPeriods}`));
  const end = Math.floor(anchor() / stepMs) * stepMs - offsetPeriods * points * stepMs;
  const perMin = 17 * (offsetPeriods ? 0.89 : 1);
  const series: TimeseriesPoint[] = [];
  for (let i = 0; i < points; i++) {
    const t = end - (points - 1 - i) * stepMs;
    const hour = new Date(t).getHours();
    const diurnal = 0.65 + 0.45 * Math.sin(((hour - 8) / 24) * Math.PI * 2);
    const noise = 0.85 + rnd() * 0.3;
    const totalAll = Math.max(1, Math.round(perMin * (stepMs / MIN) * diurnal * noise));
    const byModel: Record<string, number> = {};
    const tokensByModel: Record<string, { input: number; output: number }> = {};
    for (const [id, share] of Object.entries(MODEL_SHARE)) {
      const c = Math.round(totalAll * share * (0.9 + rnd() * 0.2));
      byModel[id] = c;
      tokensByModel[id] = { input: Math.round(c * (240 + rnd() * 60)), output: Math.round(c * (95 + rnd() * 30)) };
    }
    const requests = modelId ? (byModel[modelId] ?? 0) : Object.values(byModel).reduce((a, b) => a + b, 0);
    const errRate = (offsetPeriods ? 0.0057 : 0.0042) * (0.5 + rnd() * 1.2) + (rnd() < 0.05 ? 0.02 : 0);
    const failed = Math.round(requests * errRate);
    const lf = modelId ? (MODEL_LATENCY[modelId] ?? 1) : 1;
    const p50 = Math.round((150 + rnd() * 40) * lf * (offsetPeriods ? 1.06 : 1));
    const p95 = Math.round(p50 * (1.9 + rnd() * 0.4));
    const p99 = Math.round(p95 * (1.4 + rnd() * 0.5));
    const tok = modelId
      ? (tokensByModel[modelId] ?? { input: 0, output: 0 })
      : Object.values(tokensByModel).reduce((a, b) => ({ input: a.input + b.input, output: a.output + b.output }), {
          input: 0,
          output: 0,
        });
    series.push({
      t: iso(t),
      requests,
      success: requests - failed,
      failed,
      p50,
      p95,
      p99,
      errorRate: requests ? failed / requests : 0,
      inputTokens: tok.input,
      outputTokens: tok.output,
      byModel: modelId ? { [modelId]: requests } : byModel,
      tokensByModel: modelId ? { [modelId]: tok } : tokensByModel,
    });
  }
  return series;
}

export function summarize(range: TimeRange): MetricsSummary {
  const cur = generateTimeseries(range);
  const prev = generateTimeseries(range, undefined, 1);
  const agg = (s: TimeseriesPoint[]) => {
    const req = s.reduce((a, p) => a + p.requests, 0);
    const failed = s.reduce((a, p) => a + p.failed, 0);
    const tokens = s.reduce((a, p) => a + p.inputTokens + p.outputTokens, 0);
    const p95 = s.reduce((a, p) => a + p.p95, 0) / s.length;
    return { req, err: req ? failed / req : 0, tokens, p95 };
  };
  const c = agg(cur);
  const p = agg(prev);
  return {
    totalRequests: c.req,
    requestsChange: (c.req - p.req) / p.req,
    p95LatencyMs: Math.round(c.p95),
    p95Change: (c.p95 - p.p95) / p.p95,
    errorRate: c.err,
    errorRateChangePp: (c.err - p.err) * 100,
    totalTokens: c.tokens,
    tokensChange: (c.tokens - p.tokens) / p.tokens,
    sparklines: {
      requests: cur.map((x) => x.requests),
      latency: cur.map((x) => x.p95),
      errors: cur.map((x) => x.errorRate),
      tokens: cur.map((x) => x.inputTokens + x.outputTokens),
    },
  };
}

// ---------- evaluations ----------
const DATASETS: [string, string, string] = ["support-qa-v2 (mock)", "factuality-mini (mock)", "tool-calls-50 (mock)"];
export const DEMO_DATASETS = DATASETS;

function makeCases(rnd: () => number, n: number): EvalCase[] {
  const reasons = ["Missing required field `order_id`", "Answer contradicts reference", "Hallucinated policy detail", "Wrong tool selected", "Output not valid JSON"];
  return Array.from({ length: n }, (_, i) => ({
    id: `case_${String(i + 1).padStart(3, "0")}`,
    input: PROMPTS[Math.floor(rnd() * PROMPTS.length)]!,
    expected: '{"order_id": "88213", "refund": 42.5}',
    actual: rnd() < 0.5 ? '{"refund": 42.5}' : "The order was refunded last week.",
    reason: reasons[Math.floor(rnd() * reasons.length)]!,
  }));
}

function makeRun(seed: number, modelId: string, modelName: string, version: string, dataset: string, startedAt: number, qualityBias: number): EvaluationRun {
  const rnd = seeded(seed);
  const total = dataset.startsWith("tool") ? 50 : dataset.startsWith("fact") ? 120 : 200;
  const pass = Math.min(0.98, 0.72 + qualityBias + rnd() * 0.12);
  const passed = Math.round(total * pass);
  const failed = total - passed;
  return {
    id: `eval_${hex(rnd, 8)}`,
    dataset,
    modelId,
    modelName,
    version,
    totalCases: total,
    passed,
    failed,
    durationMs: Math.round(total * (380 + rnd() * 400)),
    startedAt: iso(startedAt),
    status: "completed",
    metrics: {
      taskSuccess: pass,
      factualCorrectness: Math.min(0.99, pass + 0.03 - rnd() * 0.06),
      hallucinationRate: Math.max(0.01, 0.14 - qualityBias * 0.5 - rnd() * 0.05),
      toolCallAccuracy: Math.min(0.99, pass - 0.02 + rnd() * 0.05),
    },
    failedCases: makeCases(rnd, Math.min(failed, 12)),
    simulated: true,
  };
}

function seedEvaluations(): EvaluationRun[] {
  const now = anchor();
  return [
    makeRun(1, "support-ft-qwen", "Support Assistant (fine-tuned)", "v3.0.0", DATASETS[0], now - 20 * HOUR, 0.12),
    makeRun(2, "support-ft-qwen", "Support Assistant (fine-tuned)", "v2.4.1", DATASETS[0], now - 4 * DAY, 0.08),
    makeRun(3, "qwen2.5-1.5b-instruct", "Qwen2.5 1.5B Instruct", "v1.2.0", DATASETS[1], now - 2 * DAY, 0.04),
    makeRun(4, "qwen2.5-1.5b-instruct", "Qwen2.5 1.5B Instruct", "v1.1.0", DATASETS[1], now - 15 * DAY, 0.02),
    makeRun(5, "support-ft-qwen", "Support Assistant (fine-tuned)", "v2.4.1", DATASETS[2], now - 5 * DAY, 0.1),
    makeRun(6, "mock-echo", "Mock Echo", "v1.0.0", DATASETS[2], now - 8 * DAY, -0.3),
  ];
}

// ---------- deployments ----------
function seedDeployments(): Deployment[] {
  const now = anchor();
  const d = (id: string, modelId: string, modelName: string, version: string, env: Deployment["environment"], status: Deployment["status"], ago: number, dur: number | null, by: string): Deployment => ({
    id,
    modelId,
    modelName,
    version,
    environment: env,
    status,
    startedAt: iso(now - ago),
    durationMs: dur,
    initiatedBy: by,
    logs: [
      `[demo] Resolving artifact ${modelId}@${version}`,
      `[demo] Loading weights on worker-0`,
      status === "failed" ? `[demo] Health check failed: readiness probe timed out after 120s` : `[demo] Health check passed`,
      status === "rolled_back" ? `[demo] Rolled back to previous version` : `[demo] Traffic shifted 100%`,
    ],
  });
  return [
    d("dep_7f3a21", "support-ft-qwen", "Support Assistant (fine-tuned)", "v3.0.0", "staging", "failed", 22 * HOUR, 131_000, "aditya"),
    d("dep_6c19e0", "qwen2.5-1.5b-instruct", "Qwen2.5 1.5B Instruct", "v1.2.0", "local", "healthy", 3 * DAY, 48_000, "aditya"),
    d("dep_5b02d4", "support-ft-qwen", "Support Assistant (fine-tuned)", "v2.4.1", "staging", "healthy", 12 * DAY, 62_000, "ci-bot"),
    d("dep_4a88f1", "qwen2.5-1.5b-instruct", "Qwen2.5 1.5B Instruct", "v1.1.0", "local", "rolled_back", 17 * DAY, 51_000, "aditya"),
    d("dep_39d7c2", "mock-echo", "Mock Echo", "v1.0.0", "local", "healthy", 90 * DAY, 4_000, "ci-bot"),
  ];
}

// ---------- mutable demo store ----------
interface Store {
  models: Model[];
  requests: InferenceRequest[];
  evaluations: EvaluationRun[];
  deployments: Deployment[];
}
let store: Store | null = null;
function db(): Store {
  if (!store) {
    const models = seedModels();
    store = { models, requests: seedRequests(models), evaluations: seedEvaluations(), deployments: seedDeployments() };
  }
  return store;
}
const clone = <T,>(x: T): T => structuredClone(x);
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const demo = {
  async listModels() {
    await delay(250);
    return clone(db().models);
  },
  async getModel(id: string) {
    await delay(200);
    const m = db().models.find((x) => x.id === id);
    if (!m) throw new Error(`Model "${id}" not found`);
    return clone(m);
  },
  async createModel(input: RegisterModelInput): Promise<Model> {
    await delay(400);
    const id = input.modelIdentifier.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-|-$/g, "");
    if (db().models.some((m) => m.id === id)) throw new Error(`A model with id "${id}" already exists`);
    const now = iso(Date.now());
    const model: Model = {
      id,
      displayName: input.displayName,
      provider: input.provider,
      modelIdentifier: input.modelIdentifier,
      description: input.description,
      endpointUrl: input.endpointUrl || null,
      status: input.status,
      latestVersion: input.version,
      activeVersion: input.status === "deployed" ? input.version : null,
      versions: [{ ...v(input.version, 0, "Initial registration", input.status === "deployed"), createdAt: now }],
      createdAt: now,
      updatedAt: now,
      tags: ["demo-created"],
    };
    db().models.unshift(model);
    return clone(model);
  },
  async registerVersion(modelId: string, version: string, notes: string) {
    await delay(300);
    const m = db().models.find((x) => x.id === modelId);
    if (!m) throw new Error("Model not found");
    if (m.versions.some((x) => x.version === version)) throw new Error(`Version ${version} already exists`);
    m.versions.unshift({ ...v(version, 0, notes || "Registered from UI", false), createdAt: iso(Date.now()) });
    m.latestVersion = version;
    m.updatedAt = iso(Date.now());
  },
  async activateVersion(modelId: string, version: string) {
    await delay(500);
    const m = db().models.find((x) => x.id === modelId);
    if (!m) throw new Error("Model not found");
    const previous = m.activeVersion;
    m.versions.forEach((x) => (x.isActive = x.version === version));
    m.activeVersion = version;
    m.status = m.status === "not_deployed" ? "staging" : m.status;
    m.updatedAt = iso(Date.now());
    db().deployments.unshift({
      id: `dep_${hex(Math.random, 6)}`,
      modelId,
      modelName: m.displayName,
      version,
      environment: "local",
      status: "healthy",
      startedAt: iso(Date.now()),
      durationMs: 1200,
      initiatedBy: "you (demo)",
      logs: [`[demo] Activated ${version}${previous ? ` (previous ${previous})` : ""}`, "[demo] No real model was loaded"],
    });
  },
  async rollback(modelId: string) {
    const m = db().models.find((x) => x.id === modelId);
    if (!m || !m.activeVersion) throw new Error("No active version to roll back from");
    const idx = m.versions.findIndex((x) => x.version === m.activeVersion);
    const target = m.versions[idx + 1];
    if (!target) throw new Error("No earlier version available");
    await demo.activateVersion(modelId, target.version);
    db().deployments[0]!.status = "rolled_back";
  },
  async listRequests() {
    await delay(300);
    return clone(db().requests);
  },
  async metricsSummary(range: TimeRange) {
    await delay(250);
    return summarize(range);
  },
  async metricsTimeseries(range: TimeRange, modelId?: string) {
    await delay(300);
    return generateTimeseries(range, modelId);
  },
  async listEvaluations() {
    await delay(250);
    return clone(db().evaluations);
  },
  async startEvaluation(modelId: string, version: string, dataset: string) {
    await delay(200);
    const m = db().models.find((x) => x.id === modelId);
    if (!m) throw new Error("Model not found");
    const seed = hashString(`${modelId}:${version}:${dataset}`);
    const run = makeRun(seed, modelId, m.displayName, version, dataset, Date.now(), modelId === "mock-echo" ? -0.3 : 0.06);
    const pending: EvaluationRun = { ...run, status: "running", passed: 0, failed: 0, metrics: null, failedCases: [], durationMs: null };
    db().evaluations.unshift(pending);
    setTimeout(() => {
      const i = db().evaluations.findIndex((e) => e.id === run.id);
      if (i >= 0) db().evaluations[i] = { ...run, durationMs: 4000 };
    }, 4000);
    return clone(pending);
  },
  async listDeployments() {
    await delay(250);
    return clone(db().deployments);
  },
  async retryDeployment(id: string) {
    await delay(300);
    const d = db().deployments.find((x) => x.id === id);
    if (!d) throw new Error("Deployment not found");
    const next: Deployment = { ...d, id: `dep_${hex(Math.random, 6)}`, status: "deploying", startedAt: iso(Date.now()), durationMs: null, initiatedBy: "you (demo)", logs: ["[demo] Retry requested", "[demo] Simulated — no real deployment triggered"] };
    db().deployments.unshift(next);
    setTimeout(() => {
      next.status = "healthy";
      next.durationMs = 3000;
      next.logs.push("[demo] Simulated health check passed");
    }, 3000);
  },
  async rollbackDeployment(id: string) {
    await delay(300);
    const d = db().deployments.find((x) => x.id === id);
    if (!d) throw new Error("Deployment not found");
    d.status = "rolled_back";
    d.logs.push("[demo] Marked as rolled back (simulated)");
  },

  /** Deterministic mock inference. Output is clearly labeled as simulated. */
  async runInference(input: InferenceInput): Promise<InferenceResult> {
    const m = db().models.find((x) => x.id === input.modelId);
    if (!m) throw new Error("Model not found");
    if (m.status === "not_deployed") {
      await delay(300);
      throw new Error(`${m.displayName} is not deployed. Activate a version or connect the backend.`);
    }
    const seed = hashString(`${input.modelId}:${input.version}:${input.systemPrompt}:${input.prompt}:${input.temperature}`);
    const rnd = seeded(seed);
    const latency = Math.round((m.id === "mock-echo" ? 60 : 450 + rnd() * 900) + input.maxTokens * 0.4);
    if (input.timeoutMs && latency > input.timeoutMs) {
      await delay(input.timeoutMs);
      const err = new Error(`Request timed out after ${input.timeoutMs} ms (simulated latency ${latency} ms)`);
      err.name = "TimeoutError";
      throw err;
    }
    await delay(latency);
    const inputTokens = Math.ceil((input.systemPrompt.length + input.prompt.length) / 4);
    const output =
      m.id === "mock-echo"
        ? `ECHO: ${input.prompt}`
        : `[SIMULATED RESPONSE — not generated by a real model]\n\nThis is a deterministic placeholder from the demo data provider for ${m.displayName} (${input.version}). ` +
          `The same prompt and settings always produce this output.\n\nPrompt digest: ${seed.toString(16)} · ${input.prompt.split(/\s+/).filter(Boolean).length} words received.\n` +
          `Connect the FastAPI backend to see real inference output.`;
    const outputTokens = Math.min(input.maxTokens, Math.ceil(output.length / 4));
    const result: InferenceResult = {
      requestId: `req_${seed.toString(16).padStart(8, "0")}${hex(rnd, 4)}`,
      modelId: m.id,
      version: input.version,
      output,
      ttftMs: Math.round(latency * 0.18),
      latencyMs: latency,
      inputTokens,
      outputTokens,
      simulated: true,
    };
    return result;
  },
};
