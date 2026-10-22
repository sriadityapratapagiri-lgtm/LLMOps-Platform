import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SourceBadge, StatusBadge } from "@/components/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { evaluationsQuery } from "@/lib/data";
import { formatDate, formatDuration, formatPercent } from "@/lib/formatters";

export const Route = createFileRoute("/evaluations")({
  head: () => ({
    meta: [
      { title: "Evaluations — Inference" },
      { name: "description", content: "Model evaluation runs, pass rates and quality metrics." },
    ],
  }),
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const { data: evals } = useSuspenseQuery(evaluationsQuery);

  return (
    <AppShell>
      <PageHeader
        title="Evaluations"
        description={`${evals.data.length} evaluation runs`}
        actions={<SourceBadge source={evals.source} />}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run ID</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Dataset</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Pass rate</TableHead>
                <TableHead className="text-right">Cases</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {evals.data.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{e.id}</TableCell>
                  <TableCell className="text-[13px] font-medium">{e.modelName}</TableCell>
                  <TableCell className="font-mono text-[12px]">{e.dataset}</TableCell>
                  <TableCell>
                    <StatusBadge value={e.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {e.totalCases > 0 ? formatPercent(e.passed / e.totalCases) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{e.totalCases}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatDuration(e.durationMs)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(e.startedAt)}</TableCell>
                </TableRow>
              ))}
              {evals.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No evaluation runs yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {evals.source === "demo" && (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Showing demo data. Connect the backend to see real evaluation runs.
        </p>
      )}
    </AppShell>
  );
}

