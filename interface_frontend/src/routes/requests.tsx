import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SourceBadge, StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requestsQuery } from "@/lib/data";
import { formatLatency, formatRelative } from "@/lib/formatters";

export const Route = createFileRoute("/requests")({
  head: () => ({
    meta: [
      { title: "Request Logs — Inference" },
      { name: "description", content: "Paginated inference request history with status, latency and token usage." },
    ],
  }),
  component: RequestsPage,
});

function RequestsPage() {
  const { data: requests } = useSuspenseQuery(requestsQuery);
  const [filter, setFilter] = useState("");

  const filtered = requests.data.filter(
    (r) =>
      r.modelName.toLowerCase().includes(filter.toLowerCase()) ||
      r.id.toLowerCase().includes(filter.toLowerCase()) ||
      (r.prompt ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <AppShell>
      <PageHeader
        title="Request Logs"
        description={`${requests.data.length} total requests`}
        actions={<SourceBadge source={requests.source} />}
      />
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border p-3">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by model, request ID or prompt…"
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Request ID</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Latency</TableHead>
                <TableHead className="text-right">Tokens in</TableHead>
                <TableHead className="text-right">Tokens out</TableHead>
                <TableHead className="text-right">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{r.id.slice(0, 18)}…</TableCell>
                  <TableCell className="font-mono text-[12px]">{r.modelName}</TableCell>
                  <TableCell>
                    <StatusBadge value={r.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatLatency(r.latencyMs)}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.inputTokens}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.outputTokens}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatRelative(r.timestamp)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                    No requests match this filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppShell>
  );
}

