import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SourceBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { modelsQuery, runInference } from "@/lib/data";
import { usePreferences } from "@/lib/config";
import { formatLatency } from "@/lib/formatters";
import type { InferenceResult } from "@/types/api";

const searchSchema = z.object({
  model: z.string().optional(),
});

export const Route = createFileRoute("/playground")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Playground — Inference" },
      { name: "description", content: "Run test inference against registered models with tunable parameters." },
      { property: "og:title", content: "Playground — Inference" },
      { property: "og:description", content: "Run test inference against registered models." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlaygroundPage,
});

function PlaygroundPage() {
  const { model: preselected } = Route.useSearch();
  const prefs = usePreferences();
  const { data: models } = useSuspenseQuery(modelsQuery);

  const [modelId, setModelId] = useState(preselected ?? prefs.defaultModelId);
  const model = models.data.find((m) => m.id === modelId) ?? models.data[0];
  const [version, setVersion] = useState(model?.activeVersion ?? model?.latestVersion ?? "");
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [prompt, setPrompt] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ res: InferenceResult; source: "live" | "demo" } | null>(null);

  const pickModel = (id: string) => {
    setModelId(id);
    const m = models.data.find((x) => x.id === id);
    setVersion(m?.activeVersion ?? m?.latestVersion ?? "");
    setResult(null);
  };

  const run = async () => {
    if (!model || !prompt.trim()) return;
    setRunning(true);
    setResult(null);
    try {
      const res = await runInference({
        modelId: model.id,
        version,
        systemPrompt,
        prompt,
        temperature,
        maxTokens,
        timeoutMs: null,
      });
      setResult({ res: res.data, source: res.source });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Inference failed");
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppShell>
      <PageHeader title="Playground" description="Send a test request to any registered model" actions={<SourceBadge source={models.source} />} />

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Model</Label>
              <Select value={model?.id ?? ""} onValueChange={pickModel}>
                <SelectTrigger><SelectValue placeholder="Select a model" /></SelectTrigger>
                <SelectContent>
                  {models.data.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.displayName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Version</Label>
              <Select value={version} onValueChange={setVersion}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(model?.versions ?? []).map((v) => (
                    <SelectItem key={v.version} value={v.version}>
                      {v.version}{v.isActive ? " (active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>System prompt</Label>
              <Textarea rows={3} value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between">
                <Label>Temperature</Label>
                <span className="font-mono text-[12px] tabular-nums">{temperature.toFixed(2)}</span>
              </div>
              <Slider value={[temperature]} min={0} max={2} step={0.05} onValueChange={([v]) => setTemperature(v!)} />
            </div>
            <div className="grid gap-2">
              <div className="flex justify-between">
                <Label>Max tokens</Label>
                <span className="font-mono text-[12px] tabular-nums">{maxTokens}</span>
              </div>
              <Slider value={[maxTokens]} min={16} max={4096} step={16} onValueChange={([v]) => setMaxTokens(v!)} />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader><CardTitle className="text-sm">Request</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask something…"
              className="font-mono text-[13px]"
            />
            <Button onClick={run} disabled={running || !prompt.trim() || !model}>
              {running ? <Loader2 className="mr-1.5 size-4 animate-spin" /> : <Play className="mr-1.5 size-4" />}
              {running ? "Running…" : "Run inference"}
            </Button>

            {result && (
              <div className="rounded-md border border-border bg-card">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2 font-mono text-[11px] text-muted-foreground">
                  <SourceBadge source={result.source} />
                  <span>ttft {formatLatency(result.res.ttftMs)}</span>
                  <span>total {formatLatency(result.res.latencyMs)}</span>
                  <span>{result.res.inputTokens} in / {result.res.outputTokens} out</span>
                  <span className="ml-auto">{result.res.requestId}</span>
                </div>
                <pre className="whitespace-pre-wrap p-3 font-mono text-[13px] leading-relaxed">{result.res.output}</pre>
                {result.res.simulated && (
                  <p className="border-t border-border px-3 py-2 text-[11px] text-warning">
                    Simulated response — connect the backend for real model output.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
