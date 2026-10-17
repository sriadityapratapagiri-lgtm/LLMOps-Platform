import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/app-shell";
import { SourceBadge, StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createModel, modelsQuery } from "@/lib/data";
import { PROVIDER_LABEL, formatDate } from "@/lib/formatters";
import type { ModelStatus, Provider } from "@/types/api";

export const Route = createFileRoute("/models/")({
  head: () => ({
    meta: [
      { title: "Model Registry — Inference" },
      { name: "description", content: "Registered models, versions and deployment status." },
      { property: "og:title", content: "Model Registry — Inference" },
      { property: "og:description", content: "Registered models, versions and deployment status." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModelsPage,
});

function RegisterModelDialog() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    displayName: "",
    provider: "local" as Provider,
    modelIdentifier: "",
    version: "v1.0.0",
    endpointUrl: "",
    description: "",
    status: "not_deployed" as ModelStatus,
  });

  const mutation = useMutation({
    mutationFn: () => {
      const { endpointUrl, ...rest } = form;
      return createModel(endpointUrl ? { ...rest, endpointUrl } : rest);
    },
    onSuccess: (res) => {
      toast.success(`Registered ${res.data.displayName}${res.source === "demo" ? " (demo)" : ""}`);
      qc.invalidateQueries({ queryKey: ["models"] });
      setOpen(false);
      navigate({ to: "/models/$id", params: { id: res.data.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to register model"),
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1.5 size-4" />Register model</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a model</DialogTitle>
          <DialogDescription>Add a model to the registry. It can be deployed afterwards.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rm-name">Display name</Label>
            <Input id="rm-name" value={form.displayName} onChange={set("displayName")} placeholder="Support Copilot" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Provider</Label>
              <Select value={form.provider} onValueChange={(v) => setForm((f) => ({ ...f, provider: v as Provider }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="openai_compatible">OpenAI-compatible</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ModelStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="not_deployed">Not deployed</SelectItem>
                  <SelectItem value="staging">Staging</SelectItem>
                  <SelectItem value="deployed">Deployed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="rm-id">Model identifier</Label>
              <Input id="rm-id" className="font-mono" value={form.modelIdentifier} onChange={set("modelIdentifier")} placeholder="qwen2.5-1.5b-instruct" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rm-ver">Initial version</Label>
              <Input id="rm-ver" className="font-mono" value={form.version} onChange={set("version")} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rm-url">Endpoint URL (optional)</Label>
            <Input id="rm-url" className="font-mono" value={form.endpointUrl} onChange={set("endpointUrl")} placeholder="http://localhost:11434/v1" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rm-desc">Description</Label>
            <Textarea id="rm-desc" rows={2} value={form.description} onChange={set("description")} />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.displayName || !form.modelIdentifier || mutation.isPending}
          >
            {mutation.isPending ? "Registering…" : "Register"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ModelsPage() {
  const { data: models } = useSuspenseQuery(modelsQuery);
  const [filter, setFilter] = useState("");
  const filtered = models.data.filter(
    (m) =>
      m.displayName.toLowerCase().includes(filter.toLowerCase()) ||
      m.modelIdentifier.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <AppShell>
      <PageHeader
        title="Model Registry"
        description={`${models.data.length} registered models`}
        actions={
          <>
            <SourceBadge source={models.source} />
            <RegisterModelDialog />
          </>
        }
      />
      <Card>
        <CardContent className="p-0">
          <div className="border-b border-border p-3">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name or identifier…"
              className="max-w-sm"
            />
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active version</TableHead>
                <TableHead>Versions</TableHead>
                <TableHead className="text-right">Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id} className="cursor-pointer">
                  <TableCell>
                    <Link to="/models/$id" params={{ id: m.id }} className="block">
                      <div className="text-[13px] font-medium hover:underline">{m.displayName}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{m.modelIdentifier}</div>
                    </Link>
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">{PROVIDER_LABEL[m.provider]}</TableCell>
                  <TableCell><StatusBadge value={m.status} /></TableCell>
                  <TableCell className="font-mono text-[12px]">{m.activeVersion ?? "—"}</TableCell>
                  <TableCell className="tabular-nums">{m.versions.length}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatDate(m.createdAt)}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                    No models match this filter.
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
