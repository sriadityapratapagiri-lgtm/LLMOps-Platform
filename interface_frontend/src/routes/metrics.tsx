import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SourceBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { metricsSummaryQuery, metricsTimeseriesQuery } from "@/lib/data";
import { formatCompact, formatLatency, formatPercent, formatAxisTime } from "@/lib/formatters";
import { usePreferences } from "@/lib/config";
import type { TimeRange } from "@/types/api";

export const Route = createFileRoute("/metrics")({
  head: () => ({
    meta: [
      { title: "Metrics — Inference" },
      { name: "description", content: "Aggregate inference metrics: request counts, latency, error rate and token usage." },
    ],
  }),
  component: MetricsPage,
});

const RANGES: { value: TimeRange; label: string }[] = [
  { value: "15m", label: "Last 15 min" },
  { value: "1h", label: "Last hour" },
  { value: "24h", label: "Last 24 h" },
  { value: "7d", label: "Last 7 days" },
];

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-[12px] font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        {sub && <div className="mt-1 text-[12px] text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function MetricsPage() {
  const prefs = usePreferences();
  const [range, setRange] = useState<TimeRange>(prefs.defaultTimeRange);

  const { data: summary } = useSuspenseQuery(metricsSummaryQuery(range));
  const { data: timeseries } = useSuspenseQuery(metricsTimeseriesQuery(range));

  const chartData = timeseries.data.map((p) => ({
    t: p.t,
    requests: p.requests,
    p95: p.p95,
    errorRate: +(p.errorRate * 100).toFixed(2),
  }));

  return (
    <AppShell>
      <PageHeader
        title="Metrics"
        description="Aggregate inference statistics"
        actions={
          <>
            <SourceBadge source={summary.source} />
            <Select value={range} onValueChange={(v) => setRange(v as TimeRange)}>
              <SelectTrigger className="w-36">
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
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total requests" value={formatCompact(summary.data.totalRequests)} />
        <StatCard label="p95 latency" value={formatLatency(summary.data.p95LatencyMs)} />
        <StatCard label="Error rate" value={formatPercent(summary.data.errorRate)} />
        <StatCard label="Total tokens" value={formatCompact(summary.data.totalTokens)} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Request volume</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <XAxis dataKey="t" tickFormatter={(v) => formatAxisTime(v as string, range)} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(v) => formatAxisTime(v as string, range)}
                  formatter={(v: number) => [formatCompact(v), "Requests"]}
                />
                <Area type="monotone" dataKey="requests" strokeWidth={1.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">p95 latency</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <XAxis dataKey="t" tickFormatter={(v) => formatAxisTime(v as string, range)} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  labelFormatter={(v) => formatAxisTime(v as string, range)}
                  formatter={(v: number) => [formatLatency(v), "p95"]}
                />
                <Area type="monotone" dataKey="p95" strokeWidth={1.5} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {summary.source === "live" && (
        <p className="mt-4 text-[12px] text-muted-foreground">
          ⚠ Token counts are word-count estimates, not true tokenizer counts. Latency measures mock execution time, not real model-serving latency.
        </p>
      )}
    </AppShell>
  );
}

