import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DataSource } from "@/types/api";

const tone: Record<string, string> = {
  success: "border-success/40 bg-success/10 text-success",
  healthy: "border-success/40 bg-success/10 text-success",
  deployed: "border-success/40 bg-success/10 text-success",
  completed: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/40 bg-warning/10 text-warning",
  degraded: "border-warning/40 bg-warning/10 text-warning",
  staging: "border-warning/40 bg-warning/10 text-warning",
  deploying: "border-warning/40 bg-warning/10 text-warning",
  running: "border-info/40 bg-info/10 text-info",
  pending: "border-info/40 bg-info/10 text-info",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  timeout: "border-destructive/40 bg-destructive/10 text-destructive",
  offline: "border-destructive/40 bg-destructive/10 text-destructive",
  not_deployed: "border-border bg-muted text-muted-foreground",
  rolled_back: "border-border bg-muted text-muted-foreground",
};

export function StatusBadge({ value, className }: { value: string; className?: string }) {
  return (
    <Badge variant="outline" className={cn("font-mono text-[11px] capitalize", tone[value] ?? tone["not_deployed"], className)}>
      {value.replace(/_/g, " ")}
      {/* index-signature safe lookup handled above */}
    </Badge>
  );
}

export function SourceBadge({ source }: { source: DataSource }) {
  if (source === "live") {
    return (
      <Badge variant="outline" className="border-success/40 bg-success/10 font-mono text-[11px] text-success">
        live
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-warning/40 bg-warning/10 font-mono text-[11px] text-warning">
      demo data
    </Badge>
  );
}
