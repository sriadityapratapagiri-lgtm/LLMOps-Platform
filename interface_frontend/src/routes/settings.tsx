import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { getPreferences, setPreferences, resetPreferences, isValidHttpUrl } from "@/lib/config";
import type { TimeRange } from "@/types/api";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Inference" },
      { name: "description", content: "Configure API connection and UI preferences." },
    ],
  }),
  component: SettingsPage,
});

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "15m", label: "15 minutes" },
  { value: "1h", label: "1 hour" },
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
];

function SettingsPage() {
  const prefs = getPreferences();
  const [apiUrl, setApiUrl] = useState(prefs.apiBaseUrlOverride ?? "");
  const [timeRange, setTimeRange] = useState<TimeRange>(prefs.defaultTimeRange);
  const [refreshInterval, setRefreshInterval] = useState(prefs.refreshIntervalSec);
  const [autoRefresh, setAutoRefresh] = useState(prefs.refreshIntervalSec > 0);

  const save = () => {
    const urlVal = apiUrl.trim();
    if (urlVal && !isValidHttpUrl(urlVal)) {
      toast.error("API URL must be a valid http:// or https:// URL");
      return;
    }
    setPreferences({
      apiBaseUrlOverride: urlVal || null,
      defaultTimeRange: timeRange,
      refreshIntervalSec: autoRefresh ? refreshInterval : 0,
    });
    toast.success("Settings saved");
  };

  const reset = () => {
    resetPreferences();
    setApiUrl("");
    setTimeRange("24h");
    setRefreshInterval(30);
    setAutoRefresh(true);
    toast.success("Settings reset to defaults");
  };

  return (
    <AppShell>
      <PageHeader title="Settings" description="Configure API connection and UI preferences" />

      <div className="max-w-xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">API Connection</CardTitle>
            <CardDescription className="text-[12px]">
              Override the backend URL. Leave empty to use the default{" "}
              <span className="font-mono">VITE_API_BASE_URL</span> (http://localhost:8000).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-1.5">
              <Label htmlFor="api-url">Backend URL</Label>
              <Input
                id="api-url"
                className="font-mono"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="http://localhost:8000"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Display Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-1.5">
              <Label>Default time range</Label>
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={setAutoRefresh}
              />
              <Label htmlFor="auto-refresh">Auto-refresh every {refreshInterval}s</Label>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button onClick={save}>Save settings</Button>
          <Button variant="outline" onClick={reset}>
            Reset to defaults
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-[12px] text-muted-foreground">
            <p>Inference — LLMOps Platform v0.1.0</p>
            <p>Backend: FastAPI / SQLite (mock inference, no GPU required)</p>
            <p>
              Token counts are word-count estimates. Latency measures mock execution time. No real model is loaded or
              deployed unless explicitly configured.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

