import { useSyncExternalStore } from "react";
import type { TimeRange } from "@/types/api";

export const ENV_API_BASE_URL: string =
  (import.meta.env["VITE_API_BASE_URL"] as string | undefined) ?? "http://localhost:8000";

export const ENVIRONMENT_LABEL = "LOCAL";

/**
 * Non-sensitive UI preferences only. Never store API keys, tokens or passwords here.
 */
export interface Preferences {
  apiBaseUrlOverride: string | null;
  defaultModelId: string;
  defaultTimeRange: TimeRange;
  refreshIntervalSec: number; // 0 = off
}

export const DEFAULT_PREFERENCES: Preferences = {
  apiBaseUrlOverride: null,
  defaultModelId: "qwen2.5-1.5b-instruct",
  defaultTimeRange: "24h",
  refreshIntervalSec: 30,
};

const KEY = "inference:preferences:v1";
const listeners = new Set<() => void>();
let cache: Preferences | null = null;

function read(): Preferences {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) } : DEFAULT_PREFERENCES;
  } catch {
    cache = DEFAULT_PREFERENCES;
  }
  return cache;
}

export function setPreferences(patch: Partial<Preferences>): void {
  cache = { ...read(), ...patch };
  window.localStorage.setItem(KEY, JSON.stringify(cache));
  listeners.forEach((l) => l());
}

export function resetPreferences(): void {
  cache = DEFAULT_PREFERENCES;
  window.localStorage.removeItem(KEY);
  listeners.forEach((l) => l());
}

export function getPreferences(): Preferences {
  return typeof window === "undefined" ? DEFAULT_PREFERENCES : read();
}

export function usePreferences(): Preferences {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => DEFAULT_PREFERENCES,
  );
}

export function getApiBaseUrl(): string {
  return (getPreferences().apiBaseUrlOverride || ENV_API_BASE_URL).replace(/\/+$/, "");
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Documented demo pricing (USD per 1M tokens). Placeholder values for UI development —
 * replace with your real provider or compute pricing. Models absent here show "Not configured".
 */
export const PRICING_CONFIG: Record<string, { inputPer1M: number; outputPer1M: number; basis: string }> = {
  "qwen2.5-1.5b-instruct": { inputPer1M: 0.05, outputPer1M: 0.1, basis: "Local GPU amortization (placeholder)" },
  "llama-3.1-8b-instruct": { inputPer1M: 0.18, outputPer1M: 0.18, basis: "OpenAI-compatible provider list price (placeholder)" },
  "support-ft-qwen": { inputPer1M: 0.08, outputPer1M: 0.16, basis: "Local GPU amortization (placeholder)" },
};

export function estimateCost(modelId: string, inputTokens: number, outputTokens: number): number | null {
  const p = PRICING_CONFIG[modelId];
  if (!p) return null;
  return (inputTokens / 1_000_000) * p.inputPer1M + (outputTokens / 1_000_000) * p.outputPer1M;
}
