import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, History, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SourceBadge, StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { demoMutations, modelQuery } from "@/lib/data";
import { estimateCost, PRICING_CONFIG } from "@/lib/config";
import { PROVIDER_LABEL, formatCurrency, formatDate } from "@/lib/formatters";

export const Route = createFileRoute("/models/$id")({
  loader: async ({ context, params }) => {
    try {
      return await context.queryClient.ensureQueryData(modelQuery(params.id));
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData, params }) => ({
    meta: [
      { title: loaderData ? `${loaderData.data.displayName} — Inference` : "Model unavailable — Inference" },
      { name: "description", content: `Model details, versions and deployments for ${params.id}.` },
      { property: "og:title", content: "Model — Inference" },
      { property: "og:description", content: "Model details, versions and deployments." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      ...(loaderData ? [] : [{ name: "robots", content: "noindex" }]),
    ],
  }),
  component: ModelDetailPage,
});

function RegisterVersionDialog({ modelId }: { modelId: string }) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => demoMutations.registerVersion(modelId, version, notes),
    onSuccess: () => {
      toast.success(`Registered ${version} (demo)`);
      qc.invalidateQueries({ queryKey: ["models", modelId] });
      setOpen(false);
      setVersion("");
      setNotes("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><History className="mr-1.5 size-4" />Register version</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Register a new version</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="nv-ver">Version</Label>
            <Input id="nv-ver" className="font-mono" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="v1.3.0" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="nv-notes">Notes</Label>
            <Textarea id="nv-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutation.mutate()} disabled={!version || mutation.isPending}>
            {mutation.isPending ? "Registering…" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelDetailPage() {
  const { id } = Route.useParams();
  const { data: model } = useSuspenseQuery(modelQuery(id));
  const m = model.data;
  const qc = useQueryClient();

  const activate = useMutation({
    mutationFn: (version: string) => demoMutations.activateVersion(id, version),
    onSuccess: () => {
      toast.success("Version activated (demo)");
      qc.invalidateQueries({ queryKey: ["models"] });
      qc.invalidateQueries({ queryKey: ["deployments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const rollback = useMutation({
    mutationFn: () => demoMutations.rollback(id),
    onSuccess: () => {
      toast.success("Rolled back to previous version (demo)");
      qc.invalidateQueries({ queryKey: ["models"] });
      qc.invalidateQueries({ queryKey: ["deployments"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Nothing to roll back to"),
  });

  const pricing = PRICING_CONFIG[m.id];
  const sampleCost = estimateCost(m.id, 1_000_000, 1_000_000);

  return (
    <AppShell>
      <div className="mb-4">
        <Link to="/models" className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Back to registry
        </Link>
      </div>
      <PageHeader
        title={m.displayName}
        description={m.description}
        actions={
          <>
            <SourceBadge source={model.source} />
            <StatusBadge value={m.status} />
            <RegisterVersionDialog modelId={id} />
            <Button size="sm" variant="outline" onClick={() => rollback.mutate()} disabled={rollback.isPending}>
              Roll back
            </Button>
            <Button size="sm" asChild>
              <Link to="/playground" search={{ model: m.id }}><Rocket className="mr-1.5 size-4" />Open in Playground</Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            <Row k="Identifier" v={<span className="font-mono">{m.modelIdentifier}</span>} />
            <Row k="Provider" v={PROVIDER_LABEL[m.provider]} />
            <Row k="Endpoint" v={<span className="font-mono">{m.endpointUrl ?? "—"}</span>} />
            <Row k="Latest version" v={<span className="font-mono">{m.latestVersion}</span>} />
            <Row k="Active version" v={<span className="font-mono">{m.activeVersion ?? "—"}</span>} />
            <Row k="Registered" v={formatDate(m.createdAt)} />
            <div className="flex flex-wrap gap-1 pt-1">
              {m.tags.map((t) => (
                <Badge key={t} variant="outline" className="font-mono text-[10px]">{t}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Cost estimate</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-[13px]">
            {pricing ? (
              <>
                <Row k="Input / 1M tokens" v={formatCurrency(pricing.inputPer1M)} />
                <Row k="Output / 1M tokens" v={formatCurrency(pricing.outputPer1M)} />
                <Row k="1M in + 1M out" v={sampleCost != null ? formatCurrency(sampleCost) : "—"} />
                <p className="pt-1 text-[11px] text-muted-foreground">{pricing.basis}</p>
              </>
            ) : (
              <p className="text-muted-foreground">Not configured for this model.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:row-span-2">
          <CardHeader><CardTitle className="text-sm">Versions</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {m.versions.map((v) => (
              <div key={v.version} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[13px] font-medium">{v.version}</span>
                  {v.isActive ? (
                    <StatusBadge value="deployed" />
                  ) : (
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => activate.mutate(v.version)} disabled={activate.isPending}>
                      Activate
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">{v.notes}</p>
                <div className="mt-1.5 flex gap-3 font-mono text-[10px] text-muted-foreground">
                  <span>ctx {v.contextWindow.toLocaleString()}</span>
                  {v.quantization && <span>{v.quantization}</span>}
                  <span>temp {v.defaultTemperature}</span>
                  <span>{formatDate(v.createdAt)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}
