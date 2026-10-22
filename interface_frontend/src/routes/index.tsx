import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SourceBadge, StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deploymentsQuery, metricsSummaryQuery, modelsQuery, requestsQuery } from "@/lib/data";
import { formatChange, formatCompact, formatLatency, formatPercent, formatPp, formatRelative } from "@/lib/formatters";
import { usePreferences } from "@/lib/config";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Inference" },
      { name: "description", content: "Overview of LLM inference traffic, latency, errors and token usage." },
      { property: "og:title", content: "Inference — LLM Inference Platform" },
      { property: "og:description", content: "Monitor, test and deploy LLM inference workloads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div className="h-10 w-24">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <Area type="monotone" dataKey="v" strokeWidth={1.5} className={className ?? ""} stroke="currentColor" fill="currentColor" fillOpacity={0.12} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  spark,
  tone,
}: {
  label: string;
  value: string;
  change: string;
  spark: number[];
  tone: "primary" | "success" | "destructive" | "info";
}) {
  const negative = change.startsWith("−");
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-[12px] font-medium text-muted-foreground">{label}</CardTitle>
        <Sparkline values={spark} className={`text-${tone}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
        <div className="mt-1 flex items-center gap-1 text-[12px] text-muted-foreground">
          {negative ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
          <span className="tabular-nums">{change}</span>
          <span>vs previous period</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const prefs = usePreferences();
  const { data: summary } = useSuspenseQuery(metricsSummaryQuery(prefs.defaultTimeRange));
  const { data: models } = useSuspenseQuery(modelsQuery);
  const { data: requests } = useSuspenseQuery(requestsQuery);
  const { data: deployments } = useSuspenseQuery(deploymentsQuery);

  const recent = requests.data.slice(0, 8);
  const activeDeployments = deployments.data.filter((d) => d.status === "healthy" || d.status === "deploying");

  return (
    <AppShell>
      <PageHeader
        title="Dashboard"
        description={`Last ${prefs.defaultTimeRange} across all models`}
        actions={<SourceBadge source={summary.source} />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Requests" value={formatCompact(summary.data.totalRequests)} change={formatChange(summary.data.requestsChange)} spark={summary.data.sparklines.requests} tone="primary" />
        <StatCard label="p95 latency" value={formatLatency(summary.data.p95LatencyMs)} change={formatChange(summary.data.p95Change)} spark={summary.data.sparklines.latency} tone="info" />
        <StatCard label="Error rate" value={formatPercent(summary.data.errorRate)} change={formatPp(summary.data.errorRateChangePp)} spark={summary.data.sparklines.errors} tone="destructive" />
        <StatCard label="Tokens" value={formatCompact(summary.data.totalTokens)} change={formatChange(summary.data.tokensChange)} spark={summary.data.sparklines.tokens} tone="success" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent requests</CardTitle>
            <Link to="/requests" className="text-[12px] text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Latency</TableHead>
                  <TableHead className="text-right">Tokens</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-[12px]">{r.modelName}</TableCell>
                    <TableCell><StatusBadge value={r.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{formatLatency(r.latencyMs)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.inputTokens + r.outputTokens}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{formatRelative(r.timestamp)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">Models</CardTitle>
              <Link to="/models" className="text-[12px] text-primary hover:underline">Registry</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {models.data.slice(0, 5).map((m) => (
                <Link key={m.id} to="/models/$id" params={{ id: m.id }} className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:bg-accent">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium">{m.displayName}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{m.activeVersion ?? m.latestVersion}</div>
                  </div>
                  <StatusBadge value={m.status} />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm">Active deployments</CardTitle>
              <Link to="/deployments" className="text-[12px] text-primary hover:underline">All</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeDeployments.length === 0 && (
                <p className="text-[13px] text-muted-foreground">No active deployments.</p>
              )}
              {activeDeployments.slice(0, 4).map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                  <div>
                    <div className="text-[13px] font-medium">{d.modelName}</div>
                    <div className="font-mono text-[11px] text-muted-foreground">{d.version} · {d.environment}</div>
                  </div>
                  <StatusBadge value={d.status} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
