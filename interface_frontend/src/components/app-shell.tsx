import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Boxes,
  FlaskConical,
  LayoutDashboard,
  ListTree,
  Rocket,
  Search,
  Settings,
  Terminal,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { connectionQuery } from "@/lib/data";
import { ENVIRONMENT_LABEL } from "@/lib/config";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/models", label: "Model Registry", icon: Boxes },
  { to: "/playground", label: "Playground", icon: Terminal },
  { to: "/requests", label: "Request Logs", icon: ListTree },
  { to: "/metrics", label: "Metrics", icon: Activity },
  { to: "/evaluations", label: "Evaluations", icon: FlaskConical },
  { to: "/deployments", label: "Deployments", icon: Rocket },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function ConnectionIndicator() {
  const { data } = useQuery(connectionQuery);
  const connected = data?.status === "connected";
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1">
      <span
        className={cn(
          "size-2 rounded-full",
          data == null ? "bg-muted-foreground" : connected ? "bg-success" : "bg-warning",
        )}
      />
      <span className="font-mono text-[11px] text-muted-foreground">
        {data == null ? "checking…" : connected ? "backend connected" : "demo mode"}
      </span>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-border bg-card/40">
        <div className="flex items-center gap-2 border-b border-border px-4 py-4">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/15 font-mono text-xs font-bold text-primary">
            ∞
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Inference</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {ENVIRONMENT_LABEL}
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors",
                  active
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-border p-3 font-mono text-[10px] text-muted-foreground">
          LLM inference platform
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-12 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur">
          <button
            onClick={() => setOpen(true)}
            className="flex w-64 items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] text-muted-foreground transition-colors hover:bg-accent"
          >
            <Search className="size-3.5" />
            <span>Search or jump to…</span>
            <kbd className="ml-auto rounded border border-border bg-muted px-1 font-mono text-[10px]">⌘K</kbd>
          </button>
          <ConnectionIndicator />
        </header>
        <main className="min-w-0 flex-1 p-6">{children}</main>
      </div>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Jump to a page…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Pages">
            {NAV.map(({ to, label, icon: Icon }) => (
              <CommandItem
                key={to}
                onSelect={() => {
                  setOpen(false);
                  navigate({ to });
                }}
              >
                <Icon className="mr-2 size-4" />
                {label}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
