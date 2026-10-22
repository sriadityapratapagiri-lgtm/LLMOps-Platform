import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SourceBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { deploymentsQuery, demoMutations } from "@/lib/data";
import { formatDate, formatDuration } from "@/lib/formatters";

export const Route = createFileRoute("/deployments")({
  head: () => ({
    meta: [
      { title: "Deployments — Inference" },
      { name: "description", content: "Model deployment history and status." },
    ],
  }),
  component: DeploymentsPage,
});

function DeploymentsPage() {
  const { data: deployments } = useSuspenseQuery(deploymentsQuery);
  const qc = useQueryClient();

  const retry = useMutation({
    mutationFn: (id: string) => demoMutations.retryDeployment(id),
    onSuccess: () => {
      toast.success("Retry triggered (demo)");
      qc.invalidateQueries({ queryKey: ["deployments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const rollback = useMutation({
    mutationFn: (id: string) => demoMutations.rollbackDeployment(id),
    onSuccess: () => {
      toast.success("Rolled back (demo)");
      qc.invalidateQueries({ queryKey: ["deployments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <AppShell>
      <PageHeader
        title="Deployments"
        description={`${deployments.data.length} deployment records`}
        actions={<SourceBadge source={deployments.source} />}
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead className="text-right">Started</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments.data.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">{d.id}</TableCell>
                  <TableCell className="text-[13px] font-medium">{d.modelName}</TableCell>
                  <TableCell className="font-mono text-[12px]">{d.version}</TableCell>
                  <TableCell className="text-[12px]">{d.environment}</TableCell>
                  <TableCell>
                    <StatusBadge value={d.status} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatDuration(d.durationMs)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(d.startedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {d.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => retry.mutate(d.id)}
                          disabled={retry.isPending}
                        >
                          Retry
                        </Button>
                      )}
                      {(d.status === "healthy" || d.status === "deploying") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => rollback.mutate(d.id)}
                          disabled={rollback.isPending}
                        >
                          Rollback
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {deployments.data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                    No deployments yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {deployments.source === "demo" && (
        <p className="mt-3 text-[12px] text-muted-foreground">
          Showing demo data. Deployment management is not yet backed by the live API.
        </p>
      )}
    </AppShell>
  );
}

